-- Salezy: allow the 'cancelled' status (user-initiated stop of a running analysis).
-- Run this in the Supabase SQL Editor.

alter table public.analyses
  drop constraint if exists analyses_status_check;

alter table public.analyses
  add constraint analyses_status_check
  check (status in ('uploaded','converting','transcribing','analyzing','completed','failed','no_speech_detected','cancelled'));
