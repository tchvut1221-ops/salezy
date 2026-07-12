-- Salezy: enforce MIME type + size limits at the storage layer, mirroring
-- lib/constants.ts's ALLOWED_MIME_TYPES/MAX_FILE_BYTES exactly — defense in
-- depth alongside the existing client-side check (isAllowedAudio), which a
-- malicious client could bypass entirely. Run this in the Supabase SQL Editor.

update storage.buckets
set
  allowed_mime_types = array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/x-flac',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ],
  file_size_limit = 52428800 -- 50MB, matching lib/constants.ts's MAX_FILE_BYTES
where id = 'recordings';
