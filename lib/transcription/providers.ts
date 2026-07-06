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
}

/** One diarized segment — the shape both OpenAI and ivrit outputs reduce to. */
export interface DiarizedSegment {
  speaker?: string;
  text?: string;
}

const DEFAULT_RUNPOD_BASE_URL = "https://api.runpod.ai/v2";

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

  if (provider === "ivrit" && (!runpodApiKey || !runpodEndpointId)) {
    throw new Error(
      "TRANSCRIPTION_PROVIDER=ivrit but RUNPOD_API_KEY / RUNPOD_ENDPOINT_ID are not set"
    );
  }

  return { provider, runpodApiKey, runpodEndpointId, runpodBaseUrl };
}

/** Fixed interval between Runpod status polls — driven by Inngest's step.sleep, not a blocking wait. */
export const RUNPOD_POLL_INTERVAL_MS = 15_000;

/**
 * Default poll ceiling: 50 minutes (200 polls @ 15s). Comfortably covers a
 * 60-minute call at whisperx+diarization's ~0.3-0.5x realtime speed on a
 * 16GB GPU (worst case ~30min processing) plus up to a minute of cold start.
 */
const DEFAULT_POLL_CEILING_MS = 50 * 60 * 1000;

/**
 * Per-call poll ceiling before giving up on Runpod, cancelling the job(s),
 * and falling back to OpenAI. Defaults to max(50min, audio_duration*0.6 +
 * 2min buffer) so long calls get a ceiling proportional to their own length
 * instead of the previous fixed 210s, which cut Runpod off before it could
 * finish anything but the shortest clips. IVRIT_TIMEOUT_MS, if set, overrides
 * the computed value entirely — an escape hatch, not required for normal use.
 */
export function computeRunpodPollCeilingMs(durationSeconds: number | null): number {
  const override = Number(process.env.IVRIT_TIMEOUT_MS);
  if (Number.isFinite(override) && override > 0) return override;
  if (!durationSeconds) return DEFAULT_POLL_CEILING_MS;
  const proportional = durationSeconds * 0.6 * 1000 + 120_000;
  return Math.max(DEFAULT_POLL_CEILING_MS, proportional);
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
