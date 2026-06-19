-- Salezy: schema versioning + flat score snapshot for dashboard aggregation.
-- The full enriched result still lives in `result` jsonb; these columns let the
-- dashboard aggregate scores without parsing every result blob.
-- Run this in the Supabase SQL Editor.

alter table public.analyses
  add column if not exists analysis_version text not null default 'v1';

alter table public.analyses
  add column if not exists scores jsonb;

-- Aggregations and trend charts only read v2 rows that carry scores.
create index if not exists analyses_user_version_idx
  on public.analyses (user_id, analysis_version);

-- No new RLS policy needed: the existing per-user policies on public.analyses
-- already cover every column, including these two.
