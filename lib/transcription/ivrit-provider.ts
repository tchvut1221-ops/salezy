import {
  formatDiarizedSegments,
  type DiarizedSegment,
  type TranscriptionConfig,
  type TranscriptionResult,
} from "./providers";

/**
 * ivrit.ai/whisper-large-v3 + pyannote transcription of a single audio chunk,
 * via a Runpod serverless endpoint. Submits an async job, polls until the job
 * completes, and reduces the diarized output to the same `דובר N:` labeled
 * Hebrew transcript the OpenAI path produces (so the scorecard is unaffected).
 *
 * MUST run inside an Inngest step (reads server-only Runpod credentials, does
 * long-running polling). Throws on any failure so the caller can fall back to
 * OpenAI.
 */

/** Runpod async job submission response. */
interface RunpodSubmitResponse {
  id?: string;
  status?: string;
}

/** Runpod status/poll response. `output` shape depends on the deployed worker. */
interface RunpodStatusResponse {
  status?: string;
  output?: unknown;
  error?: string;
}

const POLL_INTERVAL_FAST_MS = 3_000;
const POLL_INTERVAL_SLOW_MS = 5_000;
/** After this much elapsed time, back off polling from 3s to 5s. */
const BACKOFF_AFTER_MS = 30_000;

export async function transcribeWithIvrit(
  audioBase64: string,
  cfg: TranscriptionConfig
): Promise<TranscriptionResult> {
  if (!audioBase64) {
    throw new Error("transcribeWithIvrit: empty audio payload");
  }

  const base = `${cfg.runpodBaseUrl.replace(/\/+$/, "")}/${cfg.runpodEndpointId}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.runpodApiKey}`,
    "Content-Type": "application/json",
  };

  // 1) Submit the async job.
  // NOTE: this `input` object must match YOUR deployed Runpod worker. It targets
  // the spec's contract; ivrit-ai/runpod-serverless expects `blob`, and
  // navopw/runpod-worker-whisper-diarization expects `file` + `ext`. If the
  // first live call returns HTTP 400, adjust ONLY this object.
  const submitRes = await fetch(`${base}/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: {
        audio: audioBase64,
        language: "he",
        model: "ivrit-ai/whisper-large-v3",
        diarize: true,
      },
    }),
  });
  if (!submitRes.ok) {
    throw new Error(`ivrit submit failed: HTTP ${submitRes.status}`);
  }
  const submit = (await submitRes.json()) as RunpodSubmitResponse;
  const jobId = submit.id;
  if (!jobId) {
    throw new Error("ivrit submit returned no job id");
  }

  // 2) Poll until COMPLETED / FAILED, or cancel + throw on timeout.
  // Backoff: poll every 3s for the first 30s, then every 5s.
  const startedAt = Date.now();
  for (;;) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > cfg.timeoutMs) {
      await cancelJob(base, headers, jobId);
      throw new Error(`ivrit timed out after ${Math.round(elapsed / 1000)}s`);
    }
    await sleep(elapsed < BACKOFF_AFTER_MS ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS);

    let status: RunpodStatusResponse;
    try {
      const statusRes = await fetch(`${base}/status/${jobId}`, { headers });
      if (!statusRes.ok) continue; // transient — keep polling until the timeout
      status = (await statusRes.json()) as RunpodStatusResponse;
    } catch {
      continue; // network blip — keep polling until the timeout
    }

    if (status.status === "COMPLETED") {
      const segments = extractSegments(status.output);
      const text = formatDiarizedSegments(segments, extractPlainText(status.output));
      if (!text) {
        throw new Error("ivrit COMPLETED but produced no usable text");
      }
      return {
        text,
        provider: "ivrit",
        durationSeconds: extractDuration(status.output),
        language: "he",
      };
    }
    if (
      status.status === "FAILED" ||
      status.status === "CANCELLED" ||
      status.status === "TIMED_OUT"
    ) {
      throw new Error(`ivrit job ${status.status}: ${status.error ?? "unknown error"}`);
    }
    // IN_QUEUE / IN_PROGRESS → keep polling.
  }
}

/** Best-effort cancel so a hung job stops billing GPU time. Never throws. */
async function cancelJob(
  base: string,
  headers: Record<string, string>,
  jobId: string
): Promise<void> {
  try {
    await fetch(`${base}/cancel/${jobId}`, { method: "POST", headers });
  } catch {
    // best-effort only
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Defensive parse of the Runpod `output` into diarized segments. Handles both a
 * bare array of segments (navopw style) and `{ segments: [...] }` / other
 * wrappers (ivrit-ai style), reading speaker/text from the common key aliases.
 * Returns undefined when the output carries no segment array (e.g. a
 * non-diarizing endpoint), so the caller falls back to plain text.
 */
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

function extractDuration(output: unknown): number | null {
  if (isRecord(output)) {
    for (const key of ["duration", "durationSeconds", "audio_duration"]) {
      const value = output[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
  }
  return null;
}

function firstString(
  record: Record<string, unknown>,
  keys: string[]
): string | undefined {
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
