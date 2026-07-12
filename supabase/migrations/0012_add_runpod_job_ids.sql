-- Salezy: track in-flight Runpod job IDs on the analyses row so a
-- user-initiated stop (app/actions.ts's cancelAnalysis/deleteAnalysis) can
-- cancel them directly — Inngest's cancelOn only halts a run BETWEEN steps
-- and cannot run cleanup code with access to job IDs held in that run's
-- memory. Run this in the Supabase SQL Editor.

alter table public.analyses add column if not exists runpod_job_ids jsonb;
