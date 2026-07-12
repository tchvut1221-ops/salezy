# Salezy — Operations Notes

## Applying database migrations

Migrations in `supabase/migrations/` are **not auto-applied**. Run each one manually in the Supabase SQL Editor (or via `scripts/migrate.mjs` / `scripts/apply-migrations.mjs` if `DATABASE_URL` / `SUPABASE_ACCESS_TOKEN` are configured), **in numeric filename order**, before deploying code that depends on them.

Current migrations on `main`:

```
0001_create_analyses.sql
0002_storage_recordings.sql
0003_add_converting_status.sql
0004_add_analysis_version_and_scores.sql
0005_otp_codes.sql
0006_add_no_speech_status.sql
0007_add_cancelled_status.sql
0008_add_resume_support.sql
0009_otp_rate_limit_email.sql
0010_retention.sql
0011_consent_log.sql
0012_add_runpod_job_ids.sql
0013_add_transcription_provider.sql
0014_harden_recordings_bucket.sql
```

`0010` (retention: `analyses.audio_deleted_at` + purge indexes) and `0011` (`consent_log` table) were both reserved slots from the same security/legal plan, developed on separate branches and merged back to back. Both have been applied in the Supabase SQL Editor (confirmed by the user before each branch's merge, per this plan's rule of applying a migration before/with the deploy that depends on it — see the general rule below).

`0012` and `0013` were applied via the Supabase SQL Editor on 2026-07-10, same day they merged.

### Pending as of 2026-07-10: apply `0014`

`0014_harden_recordings_bucket.sql` (MIME type + size limit on the `recordings` storage bucket) has not been applied yet.

**General rule, reconfirmed twice today:** a migration file existing and being merged is not the same as the fix being live — code that depends on a new column/policy can `throw` (not just degrade) if deployed before the migration is actually applied. Apply migrations before or as part of the same deploy, not after. (See `otp_rate_limits.email` earlier today for the fail-open case, and the ivrit `runpod_job_ids`/`transcription_provider` columns for the fail-throw case — both traced to this same root cause.)

## Data retention

The retention policy lives in `lib/retention-policy.ts` (single source of truth — the upload-page disclosure and the legal docs quote it). Nightly Inngest cron `retention-sweep` (03:00 Asia/Jerusalem): deletes raw recordings 30 days after upload (60 for rows stuck mid-pipeline), stamps `audio_deleted_at`; purges `otp_codes` >24h and `otp_rate_limits` >7d. Transcripts/analyses are never auto-deleted. Verification: `npx tsx scripts/retention-selftest.ts` (pure), `scripts/retention-dryrun.ts` (read-only, real DB).

## Transcription provider

`TRANSCRIPTION_PROVIDER` env var: `"ivrit"` routes through Runpod (primary) with automatic fallback to OpenAI on timeout/failure; unset or any other value uses OpenAI only (`lib/transcription/providers.ts`'s `loadTranscriptionConfig`). Requires `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` to be set wherever `ivrit` is active.
