/**
 * Transcription provider abstraction for the Salezy pipeline.
 *
 * The pipeline transcribes Hebrew sales calls WITH speaker diarization — the
 * `דובר 1:` / `דובר 2:` labels are what make talk-ratio and the per-speaker
 * scorecard possible, so BOTH providers must emit that exact format:
 *
 *   - ivrit  → ivrit.ai/whisper-large-v3 + pyannote on Runpod serverless (primary)
 *   - openai → gpt-4o-transcribe-diarize (automatic fallback)
 *
 * Everything here reads from process.env and MUST only run inside an Inngest
 * step (server side) — never in client code (see CLAUDE.md security rules).
 */

export type TranscriptionProviderName = "ivrit" | "openai";

/** Uniform result both providers return, so the pipeline stays provider-agnostic. */
export interface TranscriptionResult {
  /** Speaker-labeled Hebrew transcript (`דובר N: …`). */
  text: string;
  provider: TranscriptionProviderName;
  durationSeconds: number | null;
  language: string;
}

/** Resolved transcription settings for the current run (server-side only). */
export interface TranscriptionConfig {
  provider: TranscriptionProviderName;
  runpodApiKey: string;
  runpodEndpointId: string;
  runpodBaseUrl: string;
  /** Hard ceiling on the Runpod poll before we cancel the job + fall back (ms). */
  timeoutMs: number;
}

/** One diarized segment — the shape both OpenAI and ivrit outputs reduce to. */
export interface DiarizedSegment {
  speaker?: string;
  text?: string;
}

const DEFAULT_RUNPOD_BASE_URL = "https://api.runpod.ai/v2";

/**
 * The Inngest route caps the whole invocation at maxDuration=300s. Keep the
 * ivrit poll ceiling comfortably below that so a failed/timed-out ivrit attempt
 * still leaves budget for the in-invocation OpenAI fallback. Override with
 * IVRIT_TIMEOUT_MS (e.g. if the providers are ever split into separate steps,
 * where each gets its own 300s budget).
 */
const DEFAULT_IVRIT_TIMEOUT_MS = 210_000;

/**
 * Reads transcription config from the environment. Throws when
 * TRANSCRIPTION_PROVIDER=ivrit but the Runpod credentials are missing — the
 * caller catches this and falls back to OpenAI, so a half-configured deploy
 * degrades gracefully instead of failing the whole pipeline.
 */
export function loadTranscriptionConfig(): TranscriptionConfig {
  const provider: TranscriptionProviderName =
    process.env.TRANSCRIPTION_PROVIDER === "ivrit" ? "ivrit" : "openai";

  const runpodApiKey = process.env.RUNPOD_API_KEY ?? "";
  const runpodEndpointId = process.env.RUNPOD_ENDPOINT_ID ?? "";
  const runpodBaseUrl = process.env.RUNPOD_BASE_URL ?? DEFAULT_RUNPOD_BASE_URL;

  const parsedTimeout = Number(process.env.IVRIT_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout
      : DEFAULT_IVRIT_TIMEOUT_MS;

  if (provider === "ivrit" && (!runpodApiKey || !runpodEndpointId)) {
    throw new Error(
      "TRANSCRIPTION_PROVIDER=ivrit but RUNPOD_API_KEY / RUNPOD_ENDPOINT_ID are not set"
    );
  }

  return { provider, runpodApiKey, runpodEndpointId, runpodBaseUrl, timeoutMs };
}

/**
 * Merge consecutive same-speaker segments into a labeled Hebrew transcript:
 *
 *   דובר 1: שלום, מדבר דני
 *   דובר 2: היי דני, מה שלומך
 *
 * Speaker keys are mapped to `דובר N` by first appearance, so OpenAI's speaker
 * ids and ivrit/pyannote's (e.g. "SPEAKER_00") both produce the identical
 * format the downstream talk-ratio / scorecard analysis expects. When no
 * segments are present (a non-diarizing endpoint), falls back to plain text.
 */
export function formatDiarizedSegments(
  segments: DiarizedSegment[] | undefined,
  fallbackText?: string
): string {
  if (!segments?.length) {
    return (fallbackText ?? "").trim();
  }

  const speakerNames = new Map<string, string>();
  const labelFor = (raw: string | undefined): string => {
    const key = raw ?? "?";
    if (!speakerNames.has(key)) {
      speakerNames.set(key, `דובר ${speakerNames.size + 1}`);
    }
    return speakerNames.get(key)!;
  };

  const lines: string[] = [];
  let lastSpeaker: string | null = null;
  for (const seg of segments) {
    const text = (seg.text ?? "").trim();
    if (!text) continue;
    const label = labelFor(seg.speaker);
    if (label === lastSpeaker) {
      lines[lines.length - 1] += ` ${text}`;
    } else {
      lines.push(`${label}: ${text}`);
      lastSpeaker = label;
    }
  }
  return lines.join("\n").trim();
}

/**
 * Join per-chunk transcription results (chunks are transcribed concurrently but
 * in order) into one result. Texts are newline-joined in chunk order; the
 * authoritative total duration comes from the caller's ffmpeg speech-check, not
 * from the per-chunk provider outputs. Speaker labels are per-chunk, unchanged
 * from the existing OpenAI path (a long, split call restarts דובר numbering per
 * chunk — a rare case since 16kHz-mono conversion keeps most calls one chunk).
 */
export function mergeResults(
  parts: TranscriptionResult[],
  provider: TranscriptionProviderName,
  durationSeconds: number | null
): TranscriptionResult {
  const text = parts
    .map((p) => p.text)
    .join("\n")
    .trim();
  const language = parts.find((p) => p.language)?.language ?? "he";
  return { text, provider, durationSeconds, language };
}
