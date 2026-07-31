-- Salezy: coaching-action completion tracking — lets a user mark items in
-- the weekly coaching plan (components/salezy/coaching-plan.tsx) as done.
-- Run this in the Supabase SQL Editor.

create table if not exists public.coaching_completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  analysis_id  uuid not null references public.analyses (id) on delete cascade,
  action_index integer not null,
  action_text  text not null,
  completed_at timestamptz not null default now(),
  unique (analysis_id, action_index)
);

create index if not exists coaching_completions_user_id_idx on public.coaching_completions (user_id);
create index if not exists coaching_completions_analysis_id_idx on public.coaching_completions (analysis_id);

alter table public.coaching_completions enable row level security;

-- Row existence IS the completion state (no boolean column to flip) — an
-- app-level toggle is insert-to-complete / delete-to-undo, so only these
-- three policies are needed, no "update own" policy.
drop policy if exists "select own coaching completions" on public.coaching_completions;
create policy "select own coaching completions" on public.coaching_completions
  for select using (auth.uid() = user_id);

drop policy if exists "insert own coaching completions" on public.coaching_completions;
create policy "insert own coaching completions" on public.coaching_completions
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own coaching completions" on public.coaching_completions;
create policy "delete own coaching completions" on public.coaching_completions
  for delete using (auth.uid() = user_id);
