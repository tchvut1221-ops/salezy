import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitIfNeeded, convertToMp3 } from "@/lib/audio";
import { transcribeAudio } from "@/lib/whisper";
import { reasonAboutCall, synthesizeAnalysis } from "@/lib/analysis";
import { needsConversion } from "@/lib/constants";

/**
 * The Salezy pipeline. Triggered by the "analysis/requested" event after a
 * recording is uploaded. Each stage is a separate Inngest step so it stays
 * within the serverless time budget and retries independently.
 *
 * All heavy work (ffmpeg chunking, Whisper, GPT-4o) lives here — never in an
 * API route.
 */
export const analyzeCall = inngest.createFunction(
  {
    id: "analyze-call",
    retries: 2,
    triggers: [{ event: "analysis/requested" }],
    onFailure: async ({ event }) => {
      // `event` here is the inngest/function.failed event.
      const failure = event as unknown as {
        data: { event: { data: { analysisId: string } }; error?: { message?: string } };
      };
      const analysisId = failure.data.event.data.analysisId;
      const admin = createAdminClient();
      await admin
        .from("analyses")
        .update({
          status: "failed",
          error: failure.data.error?.message ?? "אירעה שגיאה בעיבוד",
        })
        .eq("id", analysisId);
    },
  },
  async ({ event, step }) => {
    const analysisId = event.data.analysisId as string;
    const admin = createAdminClient();

    const filePath = await step.run("load-analysis", async () => {
      const { data, error } = await admin
        .from("analyses")
        .select("file_path")
        .eq("id", analysisId)
        .single();
      if (error) throw error;
      return data.file_path as string;
    });

    const transcript = await step.run("transcribe", async () => {
      const { data: file, error } = await admin.storage
        .from("recordings")
        .download(filePath);
      if (error || !file) throw error ?? new Error("הקובץ לא נמצא ב-Storage");

      let buffer: Buffer = Buffer.from(await file.arrayBuffer());
      let fileName = filePath.split("/").pop() ?? "audio.mp3";

      // Convert non-mp3/wav uploads (mp4/mov/ogg/m4a/aac/webm) to mp3 first.
      if (needsConversion(fileName)) {
        await admin
          .from("analyses")
          .update({ status: "converting", error: null })
          .eq("id", analysisId);
        const converted = await convertToMp3(buffer, fileName);
        buffer = converted.buffer;
        fileName = converted.name;
      }

      await admin
        .from("analyses")
        .update({ status: "transcribing", error: null })
        .eq("id", analysisId);

      const chunks = await splitIfNeeded(buffer, fileName);
      // Transcribe chunks concurrently — sequential transcription of a long
      // (split) call overruns the serverless time budget. Promise.all preserves
      // order, so the joined transcript stays in sequence.
      const parts = await Promise.all(
        chunks.map((chunk) => transcribeAudio(chunk.buffer, chunk.name))
      );
      const full = parts.join("\n").trim();

      await admin
        .from("analyses")
        .update({ transcript: full })
        .eq("id", analysisId);
      return full;
    });

    // Hybrid analysis: Claude Sonnet 4.6 reasons, GPT-4o formats to JSON.
    const reasoning = await step.run("reason", async () => {
      await admin
        .from("analyses")
        .update({ status: "analyzing" })
        .eq("id", analysisId);
      return reasonAboutCall(transcript);
    });

    const result = await step.run("synthesize", async () => {
      return synthesizeAnalysis(reasoning);
    });

    await step.run("complete", async () => {
      // Flat numeric snapshot so the dashboard can aggregate scores without
      // parsing the full `result` blob. Mark the row "v2" only when the model
      // actually produced an overall score; otherwise it stays a v1-level result.
      const perf = result.salespersonPerformance;
      const overall = result.overallScore ?? perf.overallScore;
      const scores =
        typeof overall === "number"
          ? {
              overall,
              ...(perf.scores ?? {}),
              personalityType: result.customerPersonality.type,
            }
          : null;

      await admin
        .from("analyses")
        .update({
          status: "completed",
          result,
          analysis_version: scores ? "v2" : "v1",
          scores,
        })
        .eq("id", analysisId);
    });

    return { analysisId, status: "completed" };
  }
);
