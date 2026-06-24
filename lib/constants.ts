/**
 * Max upload size. Supabase Storage's GLOBAL file size limit caps every
 * upload method (standard, TUS resumable, signed URLs — enforced server-side,
 * the same way regardless of method) at 50MB on the Free plan, with no
 * per-bucket override above that. Raising this requires upgrading the
 * Supabase project plan, not a code change.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

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
