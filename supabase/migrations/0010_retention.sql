-- Salezy: retention lifecycle support (lib/retention-policy.ts +
-- lib/inngest/retention.ts).
--
-- audio_deleted_at records when the daily retention sweep removed the raw
-- recording from Storage. The row itself — transcript and analysis included —
-- is never auto-deleted; only the audio file is subject to the retention
-- policy. NULL = recording still present (or row predates the sweep).
--
-- Run this in the Supabase SQL Editor BEFORE deploying code that references
-- audio_deleted_at: PostgREST rejects writes that mention a column missing
-- from its schema cache (PGRST204), which would make the sweep and the
-- app-level guards fail — the same class of gap as the 0009 incident.

alter table public.analyses
  add column if not exists audio_deleted_at timestamptz;

-- The daily sweep scans for "audio still present, old enough" candidates;
-- a partial index keeps that scan cheap as swept rows accumulate.
create index if not exists analyses_audio_retention_idx
  on public.analyses (created_at)
  where audio_deleted_at is null;

-- Age-based purges of operational auth data delete by created_at.
create index if not exists otp_codes_created_idx
  on public.otp_codes (created_at);

create index if not exists otp_rate_limits_created_idx
  on public.otp_rate_limits (created_at);
