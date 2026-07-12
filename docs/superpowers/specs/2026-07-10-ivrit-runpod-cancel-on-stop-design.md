# ivrit/Runpod: cancel in-flight jobs on user-initiated stop — design

## Context

The 2026-07-09 audit (finding A1) flagged that `feature/fix-runpod-timeout` — the branch that makes ivrit.ai/Runpod the primary transcription provider with automatic OpenAI fallback — has a real double-billing bug: when a user manually stops an analysis while ivrit/Runpod is transcribing, nothing cancels the in-flight Runpod job, so it keeps running (and billing) unnoticed. The user decided (2026-07-10) to fix this before merging the branch, rather than merge as-is or abandon it.

Confirmed by direct inspection of the branch: `lib/inngest/functions.ts`'s `prepare-and-submit-runpod` step builds `records: RunpodJobRecord[] = [{jobId, chunkIndex}, ...]`, which lives only in that Inngest run's in-memory closure. Inngest's `cancelOn` halts a run *between* steps only (per the code's own existing comment) — it runs no cleanup code with access to that closure. So a user-initiated stop leaves `records` permanently unreachable and the Runpod job(s) unterminated. The timeout/failure-triggered fallback path (`cancel-and-fallback-openai` step) already calls `cancelRunpodJobs(records, cfg)` correctly, because that happens *inside* the same still-running function — this bug is specific to the *external* user-stop path.

`cancelRunpodJob`/`cancelRunpodJobs` (`lib/transcription/ivrit-provider.ts`) are plain `fetch()`-based async functions with no Inngest dependency — directly callable from anywhere server-side, including `app/actions.ts`.

## Two prerequisite housekeeping items (not the core fix, but required before it)

1. **Bring `feature/fix-runpod-timeout` up to date with `main`.** The branch is stale relative to today's merges (security hardening's `file_path` ownership check + OTP rate limiting, DISC label consolidation, scorecard verbatim quotes + measured talk ratio). Merging `main` into the branch is expected to conflict in `lib/inngest/functions.ts` (both sides modified it substantially) and needs manual reconciliation — in particular, the branch's OpenAI-path call `synthesizeAnalysis(reasoning)` must be updated to main's new `synthesizeAnalysis(reasoning, transcript)` signature, and the merged `load-analysis` step must keep main's `file_path.startsWith(user_id + "/")` ownership check.
2. **Migration renumbering.** The branch's existing `supabase/migrations/0009_add_transcription_provider.sql` collides in *number* (not filename — main's `0009` is `0009_otp_rate_limit_email.sql`, a different file) with what's now on `main`. A separate, currently-unmerged "Security/Legal" plan the user is running in parallel has already reserved `0010` and `0011` for itself (confirmed with the user directly 2026-07-10; not visible in this repo's git history at all, since that work hasn't been pushed anywhere yet — trust the user's account of state this session can't see, matching the pattern of concurrent-session surprises already hit today). Resolved assignment:
   - **This fix's new migration (`runpod_job_ids` column): `0012`.**
   - `feature/fix-runpod-timeout`'s existing `0009_add_transcription_provider.sql` also needs renumbering (it can no longer be `0009` or `0010`) — leave its exact final number unresolved in this spec and re-check actual migration files immediately before renumbering it in the plan below, rather than hardcoding a guess that could already be stale by execution time.

## The fix

**Schema:** new migration `0012_add_runpod_job_ids.sql` (pending the re-check above):
```sql
alter table public.analyses add column if not exists runpod_job_ids jsonb;
```
Nullable, no index needed (never queried by value, only read/written by `id`).

**Persist on submit** (`lib/inngest/functions.ts`, `prepare-and-submit-runpod` step): immediately after building `records`, add a `persistProgress` call writing `runpod_job_ids: records` (unconditional, like `transcript`/`completed_steps` — not gated by `updateIfNotTerminal`, since this is progress metadata, not a status field, matching this codebase's existing status-vs-progress distinction).

**Clear once no longer live:**
- In `cancel-and-fallback-openai` (timeout/failure path): after `cancelRunpodJobs(records, cfg)` succeeds, also persist `runpod_job_ids: null`.
- In the final `persist-transcript` step (ivrit success path): include `runpod_job_ids: null` in that same write.

This means the column is non-null *only* during the actual window a Runpod job is genuinely in flight — exactly the window `cancelAnalysis`/`deleteAnalysis` need to check.

**Read + cancel in `app/actions.ts`:** both `cancelAnalysis` and `deleteAnalysis` currently `.select(...)` a row, verify ownership, then send the `analysis/cancel-requested` event. Add `runpod_job_ids` to each `.select(...)`, and — when non-null/non-empty — call `cancelRunpodJobs(jobRecords, loadTranscriptionConfig())` (imported from `lib/transcription/ivrit-provider.ts` / `providers.ts`) concurrently with sending the Inngest event (`Promise.all`), so the actual Runpod-billing-stopping call goes out immediately rather than waiting on anything else. Best-effort — `cancelRunpodJob` already swallows its own errors (logs, doesn't throw), so this can't break the existing cancel/delete flow if Runpod is unreachable.

**Related small fix:** `cancelRunpodJob` currently only catches network-level `fetch` exceptions — a non-2xx response from Runpod (e.g., job already completed, or an auth error) is silently treated as success. Add an `res.ok` check that logs a warning (still doesn't throw — stays best-effort) so a real cancel failure is at least visible in logs instead of invisible.

## Testing

Real Runpod credentials exist in `.env.local` on this branch now (`RUNPOD_API_KEY`/`RUNPOD_ENDPOINT_ID` are genuine, not placeholders) — per explicit user instruction, live testing is **required**, not optional, for this fix: submit a real Runpod job (a short real audio clip), call the new cancel path, and confirm via Runpod's own `/status/{id}` endpoint that the job shows cancelled — not just that the code runs without throwing. This is a stronger bar than the static-gate-only verification used for today's earlier fixes, because the entire point of this fix is an external side effect (stopping GPU billing) that static checks and pure self-tests cannot observe.

## Out of scope

- The periodic-reconciliation/sweeper-job idea (a cron function that catches any Runpod job left orphaned despite the direct-cancel path, e.g. from a network blip during cancel) — considered, rejected for now as defense-in-depth not needed on top of the direct fix; note for future if orphaned-job cost ever becomes visible in Runpod's billing dashboard.
- Everything else from the 2026-07-09 audit not related to this branch.

## Verification plan

1. Merge `main` into `feature/fix-runpod-timeout`, resolve conflicts, confirm `npx tsc --noEmit` / `npm run lint` / `npm run build` all pass on the merged result before adding new work on top.
2. Implement the fix (migration, functions.ts persist/clear, actions.ts cancel wiring, `cancelRunpodJob` res.ok check).
3. Re-run the static gate.
4. **Live test (required):** submit a real short audio file through the ivrit path, call the cancel action mid-transcription, verify via a direct Runpod status check that the job is actually cancelled (not just that no error was thrown).
5. Do **not** merge to `main` without the user's explicit "אשר merge" — stop and report after the branch is green and live-verified.
