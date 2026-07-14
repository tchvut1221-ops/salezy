import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitIfNeeded, convertToMp3, checkHasSpeech, type AudioChunk } from "@/lib/audio";
import { transcribeAudio } from "@/lib/whisper";
import { reasonAboutCall, synthesizeAnalysis } from "@/lib/analysis";
import { computeCustomerPersonality } from "@/lib/disc";
import { needsConversion } from "@/lib/constants";
import { TERMINAL_STATUSES } from "@/lib/retention-policy";

/**
 * Defense in depth: the ffmpeg volumedetect guard passed (real audio above
 * the silence threshold — e.g. music, background noise, cross-talk) but
 * Whisper still returned next to nothing. Below this length we treat it the
 * same as no_speech_detected rather than let the analysis stage fabricate a
 * report from an empty transcript.
 */
const MIN_TRANSCRIPT_CHARS = 10;

// TERMINAL_STATUSES (statuses a running pipeline should never write over
// once reached) now lives in lib/retention-policy.ts — the retention sweep
// keys "the analysis is finished" off the same list, so there's exactly one.

/**
 * Applies a STATUS change only if the row hasn't already reached a terminal
 * state. Inngest's `cancelOn` can only stop a run BETWEEN steps, never
 * mid-flight — if a user cancels while a step (e.g. transcription, Claude's
 * reasoning) is already executing, that step still finishes and would
 * otherwise overwrite the "cancelled" row with stale progress (e.g. the
 * final "complete" step declaring status: "completed" after the user
 * already stopped it). Every status-changing write in this pipeline goes
 * through this guard instead of a plain `.update()`.
 *
 * Deliberately status-only: the transcript/reasoning/completed_steps
 * progress data persisted by persistProgress() below is NOT gated the same
 * way — that data should land even if the row was cancelled mid-step, so a
 * later resume can actually skip the stage that quietly finished anyway.
 */
async function updateIfNotTerminal(
  admin: ReturnType<typeof createAdminClient>,
  analysisId: string,
  updates: Record<string, unknown>
) {
  const { error } = await admin
    .from("analyses")
    .update(updates)
    .eq("id", analysisId)
    .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`);
  if (error) throw error;
}

/**
 * Persists resume-relevant progress (transcript/reasoning + completed_steps)
 * unconditionally — never gated on the row's current status. See the note
 * on updateIfNotTerminal above for why: this is what lets a stage that
 * finished just after a cancel still count toward a later resume, instead
 * of being silently discarded along with the status write it's paired with.
 */
async function persistProgress(
  admin: ReturnType<typeof createAdminClient>,
  analysisId: string,
  updates: Record<string, unknown>
) {
  const { error } = await admin.from("analyses").update(updates).eq("id", analysisId);
  if (error) throw error;
}

/**
 * Marks an analysis row as no_speech_detected. Throws on a failed write
 * instead of swallowing it — the Supabase JS client resolves `{ error }`
 * rather than rejecting on a constraint violation (e.g. migration
 * 0006_add_no_speech_status.sql not yet applied), so silently ignoring it
 * would leave the row stuck at its previous status with no onFailure
 * trigger and no visible error. Throwing routes that failure back through
 * Inngest's normal retry/onFailure path.
 */
async function markNoSpeech(
  admin: ReturnType<typeof createAdminClient>,
  analysisId: string,
  diagnostic: string
) {
  await updateIfNotTerminal(admin, analysisId, {
    status: "no_speech_detected",
    error: diagnostic,
  });
}

/**
 * Guard + convert + split result for one raw upload, used by the transcribe
 * step below. ffmpeg output (Buffers) can't cross an Inngest step boundary,
 * so this always runs fresh inside the step that needs it.
 */
async function prepareAudio(
  admin: ReturnType<typeof createAdminClient>,
  analysisId: string,
  filePath: string
): Promise<
  | { ok: false; reason: string }
  | { ok: true; chunks: AudioChunk[]; durationSeconds: number }
> {
  const { data: file, error } = await admin.storage.from("recordings").download(filePath);
  if (error || !file) throw error ?? new Error("הקובץ לא נמצא ב-Storage");

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let fileName = filePath.split("/").pop() ?? "audio.mp3";

  const speechCheck = await checkHasSpeech(buffer, fileName);
  if (!speechCheck.ok) {
    return {
      ok: false,
      reason: `no_speech_detected: reason=${speechCheck.reason} duration=${speechCheck.durationSeconds ?? "?"}s meanVolume=${speechCheck.meanVolumeDb ?? "?"}dB`,
    };
  }

  if (needsConversion(fileName)) {
    await updateIfNotTerminal(admin, analysisId, { status: "converting", error: null });
    const converted = await convertToMp3(buffer, fileName);
    buffer = converted.buffer;
    fileName = converted.name;
  }

  await updateIfNotTerminal(admin, analysisId, { status: "transcribing", error: null });

  const chunks = await splitIfNeeded(buffer, fileName);
  return { ok: true, chunks, durationSeconds: speechCheck.durationSeconds };
}

/**
 * The Salezy pipeline. Triggered by the "analysis/requested" event after a
 * recording is uploaded (or after a user resumes a previously-stopped
 * analysis — see app/actions.ts's resumeAnalysis). Each stage is a separate
 * Inngest step so it stays within the serverless time budget and retries
 * independently.
 *
 * Resume support: `completed_steps` + the persisted `transcript`/`reasoning`
 * columns let a resumed run skip stages that already finished before the
 * stop, rather than restarting from scratch. This isn't gated on the
 * `isResume` event flag specifically — it's driven entirely by what's
 * actually persisted on the row, so a plain retry (app/actions.ts's
 * retryAnalysis) benefits from the same skip logic for free, and a resume
 * whose transcript step never actually finished correctly re-runs it.
 *
 * All heavy work (ffmpeg chunking, Whisper, GPT-4o) lives here — never in an
 * API route.
 */
export const analyzeCall = inngest.createFunction(
  {
    id: "analyze-call",
    retries: 2,
    triggers: [{ event: "analysis/requested" }],
    // User-initiated stop (app/actions.ts's cancelAnalysis/deleteAnalysis send
    // this event). `match` scopes cancellation to the run whose triggering
    // event carries the same analysisId — cancellation is a distinct Inngest
    // lifecycle from failure (inngest/function.cancelled, not
    // inngest/function.failed), so it does NOT run onFailure below; the
    // caller is responsible for flipping the row to "cancelled" itself.
    cancelOn: [{ event: "analysis/cancel-requested", match: "data.analysisId" }],
    onFailure: async ({ event }) => {
      // `event` here is the inngest/function.failed event.
      const failure = event as unknown as {
        data: { event: { data: { analysisId: string } }; error?: { message?: string } };
      };
      const analysisId = failure.data.event.data.analysisId;
      const admin = createAdminClient();
      // Raw upstream error (OpenAI/Anthropic/ffmpeg) stays server-side
      // only — this row's `error` column is selected with select("*") and
      // shipped to the owning client, so it must never carry provider
      // internals, only a safe generic message.
      console.error(`[analyzeCall] analysis ${analysisId} failed:`, failure.data.error?.message);
      await updateIfNotTerminal(admin, analysisId, {
        status: "failed",
        error: "אירעה שגיאה בעיבוד",
      });
    },
  },
  async ({ event, step }) => {
    const analysisId = event.data.analysisId as string;
    const admin = createAdminClient();

    const row = await step.run("load-analysis", async () => {
      const { data, error } = await admin
        .from("analyses")
        .select("user_id, file_path, transcript, reasoning, completed_steps")
        .eq("id", analysisId)
        .single();
      if (error) throw error;
      return data as {
        user_id: string;
        file_path: string;
        transcript: string | null;
        reasoning: string | null;
        completed_steps: string[] | null;
      };
    });

    const initialCompletedSteps = row.completed_steps ?? [];
    const filePath = row.file_path;

    // Defense in depth: app/upload/actions.ts already rejects a file_path
    // outside the caller's own folder before this event is ever sent, but
    // this download uses the service-role client (bypasses storage RLS), so
    // the invariant is re-checked here regardless of how the row was created.
    if (!filePath.startsWith(`${row.user_id}/`)) {
      await updateIfNotTerminal(admin, analysisId, {
        status: "failed",
        error: "Invalid file path for this analysis.",
      });
      return { analysisId, status: "failed" };
    }

    let transcript: string;
    if (initialCompletedSteps.includes("transcribe") && row.transcript) {
      transcript = row.transcript;
    } else {
      const transcribeResult = await step.run("transcribe", async () => {
        const prep = await prepareAudio(admin, analysisId, filePath);
        if (!prep.ok) {
          await markNoSpeech(admin, analysisId, prep.reason);
          return { ok: false as const };
        }
        const parts = await Promise.all(
          prep.chunks.map((chunk) => transcribeAudio(chunk.buffer, chunk.name))
        );
        const text = parts.join("\n").trim();
        if (text.length < MIN_TRANSCRIPT_CHARS) {
          await markNoSpeech(
            admin,
            analysisId,
            `no_speech_detected: reason=empty_transcript length=${text.length}`
          );
          return { ok: false as const };
        }
        await persistProgress(admin, analysisId, {
          transcript: text,
          transcription_provider: "openai",
          completed_steps: [...initialCompletedSteps, "transcribe"],
        });
        return { ok: true as const, transcript: text };
      });
      if (!transcribeResult.ok) {
        return { analysisId, status: "no_speech_detected" };
      }
      transcript = transcribeResult.transcript;
    }

    // Hybrid analysis: Claude Sonnet 4.6 reasons, GPT-4o formats to JSON.
    // reasonAboutCall dispatches step.ai.infer itself, which is already a
    // tracked Inngest step — it can't be nested inside another step.run.
    await step.run("set-analyzing", async () => {
      await updateIfNotTerminal(admin, analysisId, { status: "analyzing" });
    });

    let reasoning: string;
    if (initialCompletedSteps.includes("reason") && row.reasoning) {
      // Claude already finished reasoning before a previous stop — skip
      // straight to GPT-4o synthesis.
      reasoning = row.reasoning;
    } else {
      reasoning = await reasonAboutCall(transcript, step);
      await step.run("mark-reason-complete", async () => {
        await persistProgress(admin, analysisId, {
          reasoning,
          completed_steps: [
            ...new Set([...initialCompletedSteps, "transcribe", "reason"]),
          ],
        });
      });
    }

    const result = await step.run("synthesize", async () => {
      return synthesizeAnalysis(reasoning, transcript);
    });

    // Dedicated DISC engine: quantitative, quote-anchored axis scoring (lib/disc.ts)
    // replaces whatever GPT-4o's synthesis put in customerPersonality (a throwaway
    // placeholder — see lib/analysis.ts). computeCustomerPersonality owns its own
    // "score-disc" step.run internally (a self-consistency ensemble of K parallel
    // detection passes), so it must NOT be wrapped in another step.run here. Not
    // resume-gated: given the already-persisted transcript it's cheap and safe to
    // recompute on a resumed run, so unlike "reason"/"transcribe" it skips the
    // completed_steps logic.
    result.customerPersonality = await computeCustomerPersonality(transcript, step);

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
              // Omit personalityType when the DISC engine couldn't classify
              // confidently — analytics.ts already skips missing values, so no
              // downstream dashboard/analytics change is needed for this.
              ...(result.customerPersonality.indeterminate
                ? {}
                : { personalityType: result.customerPersonality.type }),
            }
          : null;

      await updateIfNotTerminal(admin, analysisId, {
        status: "completed",
        result,
        analysis_version: scores ? "v2" : "v1",
        scores,
      });
    });

    return { analysisId, status: "completed" };
  }
);
