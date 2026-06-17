-- Salezy: analyses table + RLS + realtime
-- Run this in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  file_name   text not null,
  file_path   text not null,
  status      text not null default 'uploaded'
              check (status in ('uploaded','transcribing','analyzing','completed','failed')),
  transcript  text,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists analyses_user_id_idx on public.analyses (user_id);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists analyses_set_updated_at on public.analyses;
create trigger analyses_set_updated_at
  before update on public.analyses
  for each row execute function public.set_updated_at();

-- Row Level Security: each user sees only their own rows.
alter table public.analyses enable row level security;

drop policy if exists "select own analyses" on public.analyses;
create policy "select own analyses" on public.analyses
  for select using (auth.uid() = user_id);

drop policy if exists "insert own analyses" on public.analyses;
create policy "insert own analyses" on public.analyses
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own analyses" on public.analyses;
create policy "update own analyses" on public.analyses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own analyses" on public.analyses;
create policy "delete own analyses" on public.analyses
  for delete using (auth.uid() = user_id);

-- Enable Realtime so the UI gets live status updates (safe to re-run).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'analyses'
  ) then
    alter publication supabase_realtime add table public.analyses;
  end if;
end $$;
