-- Salezy: Practice Loop — AI role-play chat sessions tied to a specific
-- analysis section. Run this in the Supabase SQL Editor.

create table if not exists public.practice_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  analysis_id      uuid not null references public.analyses (id) on delete cascade,
  section_key      text not null check (section_key in ('sales_call','followup','customer_style','scorecard')),
  focus_text       text not null,
  personality_type text not null check (personality_type in ('Analytical','Driver','Amiable','Expressive')),
  messages         jsonb not null default '[]'::jsonb,
  feedback         jsonb,
  status           text not null default 'in_progress' check (status in ('in_progress','completed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists practice_sessions_user_id_idx on public.practice_sessions (user_id);
create index if not exists practice_sessions_analysis_id_idx on public.practice_sessions (analysis_id);

-- Reuses the existing set_updated_at() trigger function (defined in
-- 0001_create_analyses.sql) — no need to redefine it.
drop trigger if exists practice_sessions_set_updated_at on public.practice_sessions;
create trigger practice_sessions_set_updated_at
  before update on public.practice_sessions
  for each row execute function public.set_updated_at();

alter table public.practice_sessions enable row level security;

drop policy if exists "select own practice sessions" on public.practice_sessions;
create policy "select own practice sessions" on public.practice_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "insert own practice sessions" on public.practice_sessions;
create policy "insert own practice sessions" on public.practice_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own practice sessions" on public.practice_sessions;
create policy "update own practice sessions" on public.practice_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own practice sessions" on public.practice_sessions;
create policy "delete own practice sessions" on public.practice_sessions
  for delete using (auth.uid() = user_id);
