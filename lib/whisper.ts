import OpenAI from "openai";
import { toFile } from "openai/uploads";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** One diarized segment — the shape gpt-4o-transcribe-diarize returns per speaker turn. */
interface DiarizedSegment {
  speaker?: string;
  text?: string;
}

/** The gpt-4o-transcribe-diarize response (diarized_json). */
interface DiarizedResponse {
  text?: string;
  segments?: DiarizedSegment[];
}

/**
 * Merge consecutive same-speaker segments into a labeled Hebrew transcript:
 *
 *   דובר 1: שלום, מדבר דני
 *   דובר 2: היי דני, מה שלומך
 *
 * Speaker keys are mapped to `דובר N` by first appearance. Falls back to plain
 * text when no segments are present.
 */
function formatDiarizedSegments(
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
 * Transcribe a single audio buffer with OpenAI's gpt-4o-transcribe-diarize
 * (Hebrew) and return the transcript with speaker labels — e.g.
 *   דובר 1: שלום, מדבר דני
 *   דובר 2: היי דני, מה שלומך
 * Speaker labels are what make talk-ratio and per-speaker analysis possible.
 *
 * The buffer MUST be under the API's 25MB limit — callers split larger files
 * first (see lib/audio.ts). Runs inside an Inngest step only.
 */
export async function transcribeAudio(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const file = await toFile(buffer, fileName);

  // `diarized_json` + `chunking_strategy` aren't in the SDK's param/return types
  // yet, so we build the request loosely and parse the response defensively.
  const res = (await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-transcribe-diarize",
    language: "he",
    response_format: "diarized_json",
    chunking_strategy: "auto",
  } as never)) as unknown as DiarizedResponse;

  return formatDiarizedSegments(res.segments, res.text);
}
