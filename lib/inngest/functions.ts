import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitIfNeeded } from "@/lib/audio";
import { transcribeAudio } from "@/lib/whisper";
import { analyzeTranscript } from "@/lib/analysis";

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
      await admin
        .from("analyses")
        .update({ status: "transcribing" })
        .eq("id", analysisId);

      const { data: file, error } = await admin.storage
        .from("recordings")
        .download(filePath);
      if (error || !file) throw error ?? new Error("הקובץ לא נמצא ב-Storage");

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = filePath.split("/").pop() ?? "audio.mp3";
      const chunks = await splitIfNeeded(buffer, fileName);

      const parts: string[] = [];
      for (const chunk of chunks) {
        parts.push(await transcribeAudio(chunk.buffer, chunk.name));
      }
      const full = parts.join("\n").trim();

      await admin
        .from("analyses")
        .update({ transcript: full })
        .eq("id", analysisId);
      return full;
    });

    const result = await step.run("analyze", async () => {
      await admin
        .from("analyses")
        .update({ status: "analyzing" })
        .eq("id", analysisId);
      return analyzeTranscript(transcript);
    });

    await step.run("complete", async () => {
      await admin
        .from("analyses")
        .update({ status: "completed", result })
        .eq("id", analysisId);
    });

    return { analysisId, status: "completed" };
  }
);
