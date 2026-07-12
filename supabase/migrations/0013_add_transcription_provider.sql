-- Salezy: record which engine transcribed each call — 'ivrit' (ivrit.ai on
-- Runpod, primary) or 'openai' (gpt-4o-transcribe-diarize, fallback). Existing
-- rows default to 'openai' since that's what produced them.
-- Run this in the Supabase SQL Editor.

alter table public.analyses
  add column if not exists transcription_provider text not null default 'openai';

-- No new RLS policy needed: the existing per-user policies on public.analyses
-- already cover every column, including this one (same as migration 0004).
