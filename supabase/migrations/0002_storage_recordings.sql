-- Salezy: private "recordings" storage bucket + RLS
-- Run this in the Supabase SQL Editor (after 0001).
-- File path convention: "<user_id>/<filename>" — the first folder MUST be the user's id.

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

drop policy if exists "users read own recordings" on storage.objects;
create policy "users read own recordings" on storage.objects
  for select using (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users upload own recordings" on storage.objects;
create policy "users upload own recordings" on storage.objects
  for insert with check (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users delete own recordings" on storage.objects;
create policy "users delete own recordings" on storage.objects
  for delete using (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
