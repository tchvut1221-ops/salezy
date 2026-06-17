import OpenAI from "openai";
import { toFile } from "openai/uploads";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Transcribe a single audio buffer with OpenAI Whisper (Hebrew).
 * The buffer MUST be under Whisper's 25MB limit — callers split larger
 * files first (see lib/audio.ts). Runs inside an Inngest step only.
 */
export async function transcribeAudio(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const file = await toFile(buffer, fileName);
  const res = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "he",
  });
  return res.text;
}
