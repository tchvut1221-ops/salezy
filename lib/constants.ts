/**
 * Max ORIGINAL upload size (pre-processing). Generous on purpose: an hour of
 * lossless FLAC is ~150MB, and the Inngest pipeline re-encodes everything down
 * to 16kHz-mono mp3 before transcription, so the size that actually matters is
 * the post-conversion one (MAX_TRANSCODED_BYTES below), not this.
 */
export const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500MB

/**
 * After ffmpeg conversion, the recording must be under this size to go to
 * transcription. Anything larger is trimmed to MAX_DURATION_SECONDS first (see
 * lib/audio.ts), with a Hebrew notice surfaced to the user.
 */
export const MAX_TRANSCODED_BYTES = 70 * 1024 * 1024; // 70MB
/** Cap applied when a converted recording is still too large: first 60 minutes. */
export const MAX_DURATION_SECONDS = 3600;

/**
 * Accepted upload formats. Anything that isn't already mp3/wav is converted to
 * mp3 inside the Inngest pipeline (see lib/audio.ts) before transcription.
 */
export const ALLOWED_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "mp4",
  "mov",
  "ogg",
  "aac",
  "webm",
  "flac",
] as const;

/** Extensions the transcription API accepts directly — everything else is converted. */
export const DIRECT_EXTENSIONS = ["mp3", "wav"] as const;

export const ALLOWED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/x-flac",
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
];

export function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** True when the file must be converted to mp3 before transcription. */
export function needsConversion(name: string): boolean {
  return !(DIRECT_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function isAllowedAudio(file: File): boolean {
  const ext = fileExtension(file.name);
  const okExt = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const okMime = file.type === "" || ALLOWED_MIME_TYPES.includes(file.type);
  return okExt && okMime && file.size <= MAX_FILE_BYTES;
}
