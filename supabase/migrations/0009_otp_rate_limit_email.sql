-- Salezy: add a per-email dimension to OTP rate limiting, alongside the
-- existing per-IP one. Run this in the Supabase SQL Editor.
--
-- NOTE: a separate, unrelated `0009_add_transcription_provider.sql` exists on
-- the unmerged feature/fix-runpod-timeout branch. Whichever branch merges
-- second must renumber its migration to 0010 to avoid a collision.

alter table public.otp_rate_limits add column if not exists email text;

create index if not exists otp_rate_limits_email_lookup_idx
  on public.otp_rate_limits (email, route, created_at);
