-- Salezy: legal consent log. Records that a user agreed to the privacy
-- policy + terms of service (docs/legal/, app/(legal)/*) at a specific
-- document version, at first successful login. Written once per email by
-- app/api/auth/verify-otp/route.ts using the admin client. Run this in the
-- Supabase SQL Editor.

create table if not exists public.consent_log (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  privacy_version  text not null,
  terms_version    text not null,
  created_at       timestamptz not null default now()
);

create index if not exists consent_log_email_idx on public.consent_log (email);

-- Same convention as otp_codes/otp_rate_limits (migration 0005): RLS enabled
-- with zero policies means no anon/authenticated client can read or write
-- this table — only the service-role key (verify-otp) ever touches it. This
-- is a legal record of what a user agreed to, not user-facing data.
alter table public.consent_log enable row level security;
