import {
  formatDiarizedSegments,
  type DiarizedSegment,
  type TranscriptionConfig,
} from "./providers";

/**
 * ivrit.ai/whisper-large-v3 + pyannote transcription via Runpod serverless,
 * restructured around Inngest's durable step model instead of a single
 * blocking poll loop:
 *
 *   - submitRunpodJob   -> POST /run             (called inside the SAME
 *                                                  Inngest step that prepares
 *                                                  the audio — see
 *                                                  lib/inngest/functions.ts's
 *                                                  "prepare-and-submit-runpod"
 *                                                  step)
 *   - checkRunpodJobs   -> GET  /status/{id} x N (one Inngest step PER POLL
 *                                                  ATTEMPT, separated by
 *                                                  step.sleep in functions.ts)
 *   - cancelRunpodJobs  -> POST /cancel/{id} x N (best-effort, the instant we
 *                                                  give up and fall back)
 *
 * Audio buffers are submitted from WITHIN the step that prepares them and
 * never returned FROM a step — Inngest caps step output at 4MB aggregate
 * (https://www.inngest.com/docs/guides/step-parallelism), far below a single
 * audio chunk (up to 24MB, see lib/audio.ts's MAX_BYTES). Only small job IDs
 * and status summaries cross step boundaries from here on. There is no
 * separate "fetch result" call — Runpod's /status response already carries
 * the completed job's output (confirmed via
 * https://docs.runpod.io/serverless/endpoints/operations; no such route
 * exists in Runpod's serverless API).
 *
 * MUST run inside Inngest steps (reads server-only Runpod credentials).
 */

interface RunpodSubmitResponse {
  id?: string;
  status?: string;
}

interface RunpodStatusResponse {
  status?: string;
  output?: unknown;
  error?: string;
}

/** One Runpod job tracked across poll attempts — one per audio chunk. */
export interface RunpodJobRecord {
  jobId: string;
  chunkIndex: number;
}

/** Result of checking a single job's status once. */
export interface RunpodJobPollState {
  chunkIndex: number;
  jobId: string;
  state: "pending" | "completed" | "terminal_failure";
  text?: string;
  errorMessage?: string;
}

/** Aggregate verdict across every chunk's job after one poll round. */
export interface RunpodPollVerdict {
  /** True once every job has either completed or hit a terminal failure. */
  done: boolean;
  /** True only when `done` and every job completed successfully. */
  ok: boolean;
  /** Chunk-ordered, newline-joined transcript — set only when ok. */
  text?: string;
  /** First terminal failure encountered, for logging. */
  failedJobId?: string;
  errorMessage?: string;
}

function runpodBase(cfg: TranscriptionConfig): string {
  return `${cfg.runpodBaseUrl.replace(/\/+$/, "")}/${cfg.runpodEndpointId}`;
}

function runpodHeaders(cfg: TranscriptionConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.runpodApiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Submits one audio chunk as an async Runpod job and returns its job id.
 * Fast (single POST) — safe to call directly inside an Inngest step.
 *
 * NOTE: this `input` object must match YOUR deployed Runpod worker. It
 * targets the ivrit-ai/pyannote diarization contract; adjust ONLY this
 * object if the first live submission returns HTTP 400.
 */
export async function submitRunpodJob(
  audioBase64: string,
  cfg: TranscriptionConfig
): Promise<string> {
  if (!audioBase64) {
    throw new Error("submitRunpodJob: empty audio payload");
  }
  const res = await fetch(`${runpodBase(cfg)}/run`, {
    method: "POST",
    headers: runpodHeaders(cfg),
    body: JSON.stringify({
      input: {
        audio_base64: audioBase64,
        language: "he",
        model: "ivrit-ai/whisper-large-v3-ct2",
        diarize: true,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`ivrit submit failed: HTTP ${res.status}`);
  }
  const submit = (await res.json()) as RunpodSubmitResponse;
  if (!submit.id) {
    throw new Error("ivrit submit returned no job id");
  }
  console.log(`[runpod] submitted job ${submit.id}`);
  return submit.id;
}

/**
 * Checks one job's current status once (no polling/looping — that lives in
 * functions.ts's step.sleep-separated loop). Network/parse errors are
 * reported back as "pending" rather than thrown, so a transient blip doesn't
 * trigger Inngest's own step-retry-with-backoff and muddy our own poll
 * cadence — the caller's poll ceiling (not an exception here) is what
 * eventually gives up.
 */
export async function checkRunpodJob(
  record: RunpodJobRecord,
  cfg: TranscriptionConfig
): Promise<RunpodJobPollState> {
  try {
    const res = await fetch(`${runpodBase(cfg)}/status/${record.jobId}`, {
      headers: runpodHeaders(cfg),
    });
    if (!res.ok) {
      return { ...record, state: "pending" }; // transient HTTP error — keep polling
    }
    const status = (await res.json()) as RunpodStatusResponse;

    if (status.status === "COMPLETED") {
      const segments = extractSegments(status.output);
      const text = formatDiarizedSegments(segments, extractPlainText(status.output));
      if (!text) {
        return {
          ...record,
          state: "terminal_failure",
          errorMessage: "ivrit COMPLETED but produced no usable text",
        };
      }
      return { ...record, state: "completed", text };
    }
    if (
      status.status === "FAILED" ||
      status.status === "CANCELLED" ||
      status.status === "TIMED_OUT"
    ) {
      return {
        ...record,
        state: "terminal_failure",
        errorMessage: `ivrit job ${status.status}: ${status.error ?? "unknown error"}`,
      };
    }
    // IN_QUEUE / IN_PROGRESS
    return { ...record, state: "pending" };
  } catch {
    return { ...record, state: "pending" }; // network blip — keep polling
  }
}

/** Checks every chunk's job in parallel — one poll round, called once per attempt. */
export async function checkRunpodJobs(
  records: RunpodJobRecord[],
  cfg: TranscriptionConfig
): Promise<RunpodJobPollState[]> {
  return Promise.all(records.map((r) => checkRunpodJob(r, cfg)));
}

/**
 * Pure aggregation over one poll round's per-job states — no I/O, covered
 * directly by scripts/verify-runpod-polling.mjs without a live endpoint.
 * `done` flips once every chunk is either completed or hit a terminal
 * failure; `ok` (only meaningful when `done`) is true only when ALL chunks
 * completed, so one failing chunk falls the WHOLE call back to OpenAI rather
 * than mixing providers within a single transcript.
 */
export function aggregatePollResults(states: RunpodJobPollState[]): RunpodPollVerdict {
  const failed = states.find((s) => s.state === "terminal_failure");
  if (failed) {
    return {
      done: true,
      ok: false,
      failedJobId: failed.jobId,
      errorMessage: failed.errorMessage,
    };
  }
  const allCompleted = states.every((s) => s.state === "completed");
  if (!allCompleted) {
    return { done: false, ok: false };
  }
  const text = [...states]
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((s) => s.text ?? "")
    .join("\n")
    .trim();
  return { done: true, ok: true, text };
}

/** Best-effort cancel so a job we're abandoning stops billing GPU time. */
export async function cancelRunpodJob(jobId: string, cfg: TranscriptionConfig): Promise<void> {
  try {
    const res = await fetch(`${runpodBase(cfg)}/cancel/${jobId}`, { method: "POST", headers: runpodHeaders(cfg) });
    if (!res.ok) {
      console.error(`[runpod] cancel returned HTTP ${res.status} for job ${jobId} (best-effort, ignoring)`);
      return;
    }
    console.log(`[runpod] cancelled job ${jobId}`);
  } catch (err) {
    console.error(`[runpod] cancel failed for job ${jobId} (best-effort, ignoring):`, err);
  }
}

export async function cancelRunpodJobs(
  records: RunpodJobRecord[],
  cfg: TranscriptionConfig
): Promise<void> {
  await Promise.all(records.map((r) => cancelRunpodJob(r.jobId, cfg)));
}

// --- defensive output parsing (unchanged from the previous implementation) ---

function extractSegments(output: unknown): DiarizedSegment[] | undefined {
  const arr = findSegmentArray(output);
  if (!arr) return undefined;
  return arr.map((raw) => ({
    speaker: firstString(raw, ["speaker", "speaker_id", "speaker_label", "spk"]),
    text: firstString(raw, ["text", "transcript", "content", "sentence"]),
  }));
}

function findSegmentArray(output: unknown): Record<string, unknown>[] | undefined {
  if (Array.isArray(output)) {
    return output as Record<string, unknown>[];
  }
  if (isRecord(output)) {
    for (const key of ["segments", "result", "transcription", "chunks", "output"]) {
      if (Array.isArray(output[key])) {
        return output[key] as Record<string, unknown>[];
      }
    }
  }
  return undefined;
}

function extractPlainText(output: unknown): string | undefined {
  if (typeof output === "string") return output;
  if (isRecord(output)) {
    return firstString(output, ["text", "transcription", "transcript", "result"]);
  }
  return undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
