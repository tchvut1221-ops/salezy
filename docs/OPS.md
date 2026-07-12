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
0012_add_runpod_job_ids.sql
0013_add_transcription_provider.sql
```

**`0010` and `0011` are intentionally missing** — reserved by a separate, concurrently-developed plan not yet merged to this branch. This is expected, not a bug; do not renumber `0012`/`0013` down to fill the gap.

### Pending as of 2026-07-10: apply `0012` then `0013`

Neither has been applied to the live Supabase project yet. **Apply `0012_add_runpod_job_ids.sql` before `0013_add_transcription_provider.sql`** (plain numeric order — no functional dependency between the two columns they add, but keep the convention so migration history stays a reliable audit trail).

**Do this before enabling `TRANSCRIPTION_PROVIDER=ivrit` in any environment, including Vercel production.** The ivrit transcription path writes to both `runpod_job_ids` (`lib/inngest/functions.ts`) and `transcription_provider` (`lib/transcription/providers.ts`) as part of the transcribe step. Supabase's PostgREST layer rejects an `update`/`insert` referencing a column that doesn't exist yet in its schema cache — the whole call fails, not just the missing field. Unlike a rate-limit degrading silently, this failure `throw`s inside the transcribe step, which fails the whole analysis. Confirmed the hard way earlier today with a different pair of columns (see `otp_rate_limits.email`, applied via migration `0009_otp_rate_limit_email.sql`) — the lesson generalizes: **a migration file existing and being merged is not the same as the fix being live.** Apply the migration first, or keep `TRANSCRIPTION_PROVIDER` unset/`openai` until it's confirmed applied.

## Transcription provider

`TRANSCRIPTION_PROVIDER` env var: `"ivrit"` routes through Runpod (primary) with automatic fallback to OpenAI on timeout/failure; unset or any other value uses OpenAI only (`lib/transcription/providers.ts`'s `loadTranscriptionConfig`). Requires `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` to be set wherever `ivrit` is active.
