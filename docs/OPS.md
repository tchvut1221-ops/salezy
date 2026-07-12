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
<<<<<<< HEAD
0010_retention.sql
=======
0011_consent_log.sql
>>>>>>> feat/a4-legal
0012_add_runpod_job_ids.sql
0013_add_transcription_provider.sql
0014_harden_recordings_bucket.sql
```

<<<<<<< HEAD
**`0011` is intentionally missing** — reserved for the consent-log migration of the security/legal plan (`0010` was the other reserved slot, now filled by the retention migration). This is expected, not a bug; do not renumber `0012`/`0013`/`0014` down to fill the gap. Note `0010` merged *after* `0012`-`0014` — numeric order still holds for fresh environments (they're independent), but on the live DB it is applied later.
=======
**`0010` is intentionally missing** — reserved for a retention-lifecycle migration on a separate, concurrently-developed branch of the same security/legal plan (not yet merged here). `0011` above is this plan's own migration (consent_log). This is expected, not a bug; do not renumber `0012`/`0013`/`0014` down to fill the gap.

### Pending: apply `0011` with the legal-docs deploy

`0011_consent_log.sql` (adds the `consent_log` table — service-role-only RLS, same convention as `otp_codes`) must be applied in the Supabase SQL Editor **before or together with** deploying this branch — `app/api/auth/verify-otp/route.ts`'s `recordConsentIfNew` references the table (best-effort/non-fatal on failure, but it should still succeed in production).
>>>>>>> feat/a4-legal

`0012` and `0013` were applied via the Supabase SQL Editor on 2026-07-10, same day they merged.

### Pending as of 2026-07-10: apply `0014`

`0014_harden_recordings_bucket.sql` (MIME type + size limit on the `recordings` storage bucket) has not been applied yet.

**General rule, reconfirmed twice today:** a migration file existing and being merged is not the same as the fix being live — code that depends on a new column/policy can `throw` (not just degrade) if deployed before the migration is actually applied. Apply migrations before or as part of the same deploy, not after. (See `otp_rate_limits.email` earlier today for the fail-open case, and the ivrit `runpod_job_ids`/`transcription_provider` columns for the fail-throw case — both traced to this same root cause.)

### Pending: apply `0010` with the retention deploy

`0010_retention.sql` (adds `analyses.audio_deleted_at` + purge indexes) must be applied in the Supabase SQL Editor **before or together with** deploying the retention branch — the nightly sweep (`lib/inngest/retention.ts`), the retry/resume guards (`app/actions.ts`), and the analysis page all reference the new column. Before the first live sweep, run the read-only report `npx tsx --env-file=.env.local scripts/retention-dryrun.ts` to see exactly which recordings it will delete.

## Data retention

The retention policy lives in `lib/retention-policy.ts` (single source of truth — the upload-page disclosure and the legal docs quote it). Nightly Inngest cron `retention-sweep` (03:00 Asia/Jerusalem): deletes raw recordings 30 days after upload (60 for rows stuck mid-pipeline), stamps `audio_deleted_at`; purges `otp_codes` >24h and `otp_rate_limits` >7d. Transcripts/analyses are never auto-deleted. Verification: `npx tsx scripts/retention-selftest.ts` (pure), `scripts/retention-dryrun.ts` (read-only, real DB).

## Transcription provider

`TRANSCRIPTION_PROVIDER` env var: `"ivrit"` routes through Runpod (primary) with automatic fallback to OpenAI on timeout/failure; unset or any other value uses OpenAI only (`lib/transcription/providers.ts`'s `loadTranscriptionConfig`). Requires `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` to be set wherever `ivrit` is active.
