-- Salezy: raise the recordings bucket file-size limit to 500MB.
-- Run this in the Supabase SQL Editor.
--
-- Context: the app now accepts originals up to 500MB (lossless FLAC etc.) and
-- down-converts to 16kHz-mono mp3 in the Inngest pipeline. The per-bucket limit
-- must allow the ORIGINAL through.
--
-- IMPORTANT: the bucket limit cannot exceed the PROJECT global upload limit.
-- If uploads over 50MB still fail after this, raise the global limit in the
-- dashboard: Project Settings → Storage → "Upload file size limit" → 500 MB.

update storage.buckets
set file_size_limit = 524288000 -- 500 * 1024 * 1024
where id = 'recordings';
