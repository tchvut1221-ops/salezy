import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { formatDiarizedSegments, type DiarizedSegment } from "@/lib/transcription/providers";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** The gpt-4o-transcribe-diarize response (diarized_json). */
interface DiarizedResponse {
  text?: string;
  segments?: DiarizedSegment[];
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
