/** File-upload rules (mirrored client + server). */
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB
export const ALLOWED_EXTENSIONS = ["mp3", "wav", "m4a"] as const;
export const ALLOWED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
];

export function isAllowedAudio(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const okExt = (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const okMime = file.type === "" || ALLOWED_MIME_TYPES.includes(file.type);
  return okExt && okMime && file.size <= MAX_FILE_BYTES;
}
