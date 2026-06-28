-- Salezy: self-managed OTP login (own code generation + Resend email).
-- Run this in the Supabase SQL Editor.

create table if not exists public.otp_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  attempts    int not null default 0,
  consumed_at timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists otp_codes_email_idx on public.otp_codes (email);

-- Locked down: only the service-role key (used exclusively by the
-- app/api/auth/* route handlers) ever touches this table. No policies here
-- means no client (anon or authenticated) can read or write it at all.
alter table public.otp_codes enable row level security;

create table if not exists public.otp_rate_limits (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  route      text not null check (route in ('send', 'verify')),
  created_at timestamptz not null default now()
);

create index if not exists otp_rate_limits_lookup_idx
  on public.otp_rate_limits (ip, route, created_at);

alter table public.otp_rate_limits enable row level security;
