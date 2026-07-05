import { transcribeAudio } from "@/lib/whisper";
import type { TranscriptionResult } from "./providers";

/**
 * OpenAI transcription of a single audio chunk, as a TranscriptionResult. Thin
 * wrapper over the existing gpt-4o-transcribe-diarize call in lib/whisper.ts —
 * used both as the configured provider (TRANSCRIPTION_PROVIDER=openai) and as
 * the automatic fallback when ivrit.ai fails.
 *
 * durationSeconds is null here: the diarize API doesn't return it, so the
 * caller fills the authoritative total from the ffmpeg speech-check.
 */
export async function transcribeWithOpenAI(
  buffer: Buffer,
  fileName: string
): Promise<TranscriptionResult> {
  const text = await transcribeAudio(buffer, fileName);
  return { text, provider: "openai", durationSeconds: null, language: "he" };
}
