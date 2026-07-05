-- Salezy: track completed pipeline stages + persisted reasoning so a
-- cancelled analysis can resume from where it stopped instead of restarting.
-- Run this in the Supabase SQL Editor.

alter table public.analyses
  add column if not exists completed_steps text[] not null default '{}';

-- Claude's free-form reasoning output (lib/analysis.ts's reasonAboutCall) —
-- persisted so a resumed run can skip re-calling Claude when it already
-- completed before the stop, and only re-run the GPT-4o synthesis step.
alter table public.analyses
  add column if not exists reasoning text;
