-- Salezy: allow the 'no_speech_detected' status (pre-transcription guard —
-- empty/silent uploads short-circuit here instead of running a fabricated
-- analysis on nothing).
-- Run this in the Supabase SQL Editor.

alter table public.analyses
  drop constraint if exists analyses_status_check;

alter table public.analyses
  add constraint analyses_status_check
  check (status in ('uploaded','converting','transcribing','analyzing','completed','failed','no_speech_detected'));
