# ivrit/Runpod Cancel-on-Stop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the double-billing bug on `feature/fix-runpod-timeout` — a user-initiated stop currently leaves an in-flight Runpod job running and billing, because the job IDs only exist in the cancelled Inngest run's unreachable memory.

**Architecture:** Persist Runpod job IDs to the `analyses` row the moment they're submitted; clear them back to null once transcription concludes (success or fallback). `app/actions.ts`'s `cancelAnalysis`/`deleteAnalysis` read that column directly and call Runpod's cancel API themselves — independent of Inngest's cancellation lifecycle, which cannot run cleanup code with access to the original run's state.

**Tech Stack:** TypeScript, Supabase Postgres (new migration), Runpod serverless API (real credentials available in `.env.local` on this branch). No test framework — verification is `npx tsc --noEmit` / `npm run lint` / `npm run build`, plus a **required live test** against the real Runpod API (this fix's entire purpose is an external side effect static checks can't observe).

**Spec:** `docs/superpowers/specs/2026-07-10-ivrit-runpod-cancel-on-stop-design.md`

**Starting branch:** `feature/fix-runpod-timeout` (already has the spec committed as `b07b988`). All work happens on this branch — it is NOT fresh off `main`.

---

### Task 1: Merge `main` into `feature/fix-runpod-timeout`

This branch is stale relative to today's work on `main` (security hardening, DISC label fix, scorecard verbatim quotes + measured talk ratio). Verified in advance (dry-run merge, then aborted): this merges **cleanly with zero conflicts** — main and the branch touched non-overlapping parts of `lib/inngest/functions.ts`. `npx tsc --noEmit` passes on the merged result.

**Files:** none edited directly — this is a git merge.

- [ ] **Step 1: Confirm current branch and clean state**

Run: `cd "C:\Users\PC\Claude\salezy" && git status --short && git branch --show-current`
Expected: clean tree, output `feature/fix-runpod-timeout`.

- [ ] **Step 2: Merge main**

Run: `git fetch origin main && git merge main`
Expected: `Merge made by the 'ort' strategy.` (or similar), **no** `CONFLICT` lines. If a conflict appears, STOP — this plan's Task 1 assumed a clean merge based on a verified dry-run; a conflict means something changed on `main` since this plan was written. Report back rather than guessing a resolution.

- [ ] **Step 3: Verify the two critical pieces of main's work survived the merge**

Run: `cd "C:\Users\PC\Claude\salezy" && grep -n "filePath.startsWith" lib/inngest/functions.ts && grep -n "synthesizeAnalysis(reasoning, transcript)" lib/inngest/functions.ts`
Expected: both greps return a match (the file_path ownership check and the transcript-threaded synthesizeAnalysis call from today's earlier merges).

- [ ] **Step 4: Static gate on the merged result**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

The merge commit itself (from Step 2) already serves as this task's commit — no separate commit needed.

---

### Task 2: Migration housekeeping — renumber the branch's migration, add the new one

**Files:**
- Rename: `supabase/migrations/0009_add_transcription_provider.sql` → next available number after re-checking (see Step 1)
- Create: `supabase/migrations/00XX_add_runpod_job_ids.sql` (exact number determined in Step 1 — as of this plan's writing, `0012` is confirmed free and reserved for this; re-verify before using it, since a separate concurrent "Security/Legal" plan has claimed `0010` and `0011` and may have landed them by execution time)

- [ ] **Step 1: Check actual current migration files — do not trust any number from this plan or the spec without re-verifying**

Run: `cd "C:\Users\PC\Claude\salezy" && ls supabase/migrations/`
Look at the highest-numbered file. If it's still `0009_otp_rate_limit_email.sql` (nothing at 0010/0011 yet), proceed with: rename the branch's `0009_add_transcription_provider.sql` → `0010_add_transcription_provider.sql`, and the new job-tracking migration is `0011_add_runpod_job_ids.sql`. If `0010` and/or `0011` already exist (the concurrent plan landed), use the next free numbers instead (e.g., branch's migration → `0012`, new migration → `0013`) — whatever is actually free, checked fresh right now.

- [ ] **Step 2: Rename the branch's existing migration**

Run (adjust the target number per Step 1's finding): `git mv supabase/migrations/0009_add_transcription_provider.sql supabase/migrations/00XX_add_transcription_provider.sql`

- [ ] **Step 3: Create the new migration**

Create `supabase/migrations/00XX_add_runpod_job_ids.sql` (next number after Step 2's, per Step 1's check):

```sql
-- Salezy: track in-flight Runpod job IDs on the analyses row so a
-- user-initiated stop (app/actions.ts's cancelAnalysis/deleteAnalysis) can
-- cancel them directly — Inngest's cancelOn only halts a run BETWEEN steps
-- and cannot run cleanup code with access to job IDs held in that run's
-- memory. Run this in the Supabase SQL Editor.

alter table public.analyses add column if not exists runpod_job_ids jsonb;
```

- [ ] **Step 4: Verify build still passes (migration files aren't type-checked, but confirm nothing else broke)**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add supabase/migrations/
git commit -m "chore: resolve migration numbering, add runpod_job_ids column

Renumbers this branch's 0009_add_transcription_provider.sql (main has
its own unrelated 0009 now) and adds a new migration for tracking
in-flight Runpod job IDs, needed by the cancel-on-stop fix.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Persist and clear `runpod_job_ids` in the transcribe step

**Files:**
- Modify: `lib/inngest/functions.ts` (the `prepare-and-submit-runpod`, `cancel-and-fallback-openai`, and `persist-transcript` steps)

- [ ] **Step 1: Persist job IDs immediately after submission**

Find in `lib/inngest/functions.ts`:

```ts
          const records: RunpodJobRecord[] = jobIds.map((jobId, chunkIndex) => ({
            jobId,
            chunkIndex,
          }));
          console.log(
            `[transcribe] analysis ${analysisId}: submitted ${records.length} ivrit job(s): ${records.map((r) => r.jobId).join(", ")}`
          );
          return { ok: true as const, records, durationSeconds: prep.durationSeconds };
```

Replace with:

```ts
          const records: RunpodJobRecord[] = jobIds.map((jobId, chunkIndex) => ({
            jobId,
            chunkIndex,
          }));
          await persistProgress(admin, analysisId, { runpod_job_ids: records });
          console.log(
            `[transcribe] analysis ${analysisId}: submitted ${records.length} ivrit job(s): ${records.map((r) => r.jobId).join(", ")}`
          );
          return { ok: true as const, records, durationSeconds: prep.durationSeconds };
```

- [ ] **Step 2: Clear job IDs once the fallback-cancel path actually cancels them**

Find:

```ts
          await step.run("cancel-and-fallback-openai", async () => {
            console.error(
              `[transcribe] analysis ${analysisId}: ${reason} — cancelling remaining Runpod job(s) and falling back to OpenAI`
            );
            const cfg = loadTranscriptionConfig();
            await cancelRunpodJobs(records, cfg);
          });
```

Replace with:

```ts
          await step.run("cancel-and-fallback-openai", async () => {
            console.error(
              `[transcribe] analysis ${analysisId}: ${reason} — cancelling remaining Runpod job(s) and falling back to OpenAI`
            );
            const cfg = loadTranscriptionConfig();
            await cancelRunpodJobs(records, cfg);
            await persistProgress(admin, analysisId, { runpod_job_ids: null });
          });
```

- [ ] **Step 3: Clear job IDs on the ivrit-success path too**

Find:

```ts
        await step.run("persist-transcript", async () => {
          await persistProgress(admin, analysisId, {
            transcript: result.text,
            transcription_provider: result.provider,
            completed_steps: [...initialCompletedSteps, "transcribe"],
          });
        });
        transcript = result.text;
```

Replace with:

```ts
        await step.run("persist-transcript", async () => {
          await persistProgress(admin, analysisId, {
            transcript: result.text,
            transcription_provider: result.provider,
            runpod_job_ids: null,
            completed_steps: [...initialCompletedSteps, "transcribe"],
          });
        });
        transcript = result.text;
```

(This runs on both the pure-ivrit-success path and the post-fallback path — in the fallback case `runpod_job_ids` is already `null` from Step 2, so this is a harmless re-write; in the pure-ivrit-success case, this is what actually clears it.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add lib/inngest/functions.ts
git commit -m "feat: persist runpod_job_ids so it can be cancelled outside the Inngest run

Written immediately on submission, cleared to null once transcription
concludes (ivrit success or OpenAI fallback) — non-null only during
the genuine in-flight window. Sets up the actual cancel-on-stop fix
in app/actions.ts (next commit).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Check the Runpod cancel HTTP response, not just network exceptions

**Files:**
- Modify: `lib/transcription/ivrit-provider.ts` (`cancelRunpodJob`)

- [ ] **Step 1: Add the `res.ok` check**

Find:

```ts
export async function cancelRunpodJob(jobId: string, cfg: TranscriptionConfig): Promise<void> {
  try {
    await fetch(`${runpodBase(cfg)}/cancel/${jobId}`, { method: "POST", headers: runpodHeaders(cfg) });
    console.log(`[runpod] cancelled job ${jobId}`);
  } catch (err) {
    console.error(`[runpod] cancel failed for job ${jobId} (best-effort, ignoring):`, err);
  }
}
```

Replace with:

```ts
export async function cancelRunpodJob(jobId: string, cfg: TranscriptionConfig): Promise<void> {
  try {
    const res = await fetch(`${runpodBase(cfg)}/cancel/${jobId}`, { method: "POST", headers: runpodHeaders(cfg) });
    if (!res.ok) {
      console.error(`[runpod] cancel returned HTTP ${res.status} for job ${jobId} (best-effort, ignoring)`);
      return;
    }
    console.log(`[runpod] cancelled job ${jobId}`);
  } catch (err) {
    console.error(`[runpod] cancel failed for job ${jobId} (best-effort, ignoring):`, err);
  }
}
```

Still best-effort (doesn't throw either way) — this only makes a real cancel failure visible in logs instead of silently logged as success.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add lib/transcription/ivrit-provider.ts
git commit -m "fix: check Runpod cancel HTTP response, not just network exceptions

A non-2xx response (e.g. job already finished, auth error) was
previously indistinguishable from a real success — now logged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire the actual cancel into `app/actions.ts`

**Files:**
- Modify: `app/actions.ts` (imports, `cancelAnalysis`, `deleteAnalysis`)

- [ ] **Step 1: Add imports**

Find the existing imports at the top of `app/actions.ts`:

```ts
import { inngest } from "@/lib/inngest/client";
import type { AnalysisStatus } from "@/types";
```

Replace with:

```ts
import { inngest } from "@/lib/inngest/client";
import { cancelRunpodJobs, type RunpodJobRecord } from "@/lib/transcription/ivrit-provider";
import { loadTranscriptionConfig } from "@/lib/transcription/providers";
import type { AnalysisStatus } from "@/types";
```

- [ ] **Step 2: Wire `cancelAnalysis`**

Find:

```ts
export async function cancelAnalysis(analysisId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }
  if (!RUNNING_STATUSES.includes(data.status as AnalysisStatus)) {
    throw new Error("Analysis is not currently running");
  }

  await inngest.send({ name: "analysis/cancel-requested", data: { analysisId } });

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: "cancelled", error: null })
    .eq("id", analysisId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;
}
```

Replace with:

```ts
export async function cancelAnalysis(analysisId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, runpod_job_ids")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }
  if (!RUNNING_STATUSES.includes(data.status as AnalysisStatus)) {
    throw new Error("Analysis is not currently running");
  }

  // Cancelling the Inngest run (below) only stops it BETWEEN steps and
  // can't reach an in-flight Runpod job's ID, which only lives in that
  // run's own memory — so a live job ID persisted on the row (set by
  // lib/inngest/functions.ts's prepare-and-submit-runpod step) is cancelled
  // directly here instead. Best-effort: cancelRunpodJobs never throws.
  const jobRecords = data.runpod_job_ids as RunpodJobRecord[] | null;
  await Promise.all([
    inngest.send({ name: "analysis/cancel-requested", data: { analysisId } }),
    jobRecords?.length ? cancelRunpodJobs(jobRecords, loadTranscriptionConfig()) : Promise.resolve(),
  ]);

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: "cancelled", error: null })
    .eq("id", analysisId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;
}
```

- [ ] **Step 3: Wire `deleteAnalysis`**

Find:

```ts
  if (RUNNING_STATUSES.includes(data.status as AnalysisStatus)) {
    await inngest.send({ name: "analysis/cancel-requested", data: { analysisId } });
  }
```

Replace with:

```ts
  if (RUNNING_STATUSES.includes(data.status as AnalysisStatus)) {
    // See cancelAnalysis above for why the Runpod job is cancelled directly
    // here rather than relying on Inngest's cancelOn.
    const jobRecords = data.runpod_job_ids as RunpodJobRecord[] | null;
    await Promise.all([
      inngest.send({ name: "analysis/cancel-requested", data: { analysisId } }),
      jobRecords?.length ? cancelRunpodJobs(jobRecords, loadTranscriptionConfig()) : Promise.resolve(),
    ]);
  }
```

- [ ] **Step 4: Add `runpod_job_ids` to `deleteAnalysis`'s select**

Find:

```ts
  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, file_path")
    .eq("id", analysisId)
    .single();
```

Replace with:

```ts
  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, file_path, runpod_job_ids")
    .eq("id", analysisId)
    .single();
```

(This is `deleteAnalysis`'s select — verify by context: it's the one that also selects `file_path`, distinct from `cancelAnalysis`'s select handled in Step 2 and `retryAnalysis`'s/`resumeAnalysis`'s selects elsewhere in the same file, which should NOT be touched.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add app/actions.ts
git commit -m "fix(ivrit): cancel in-flight Runpod jobs on user-initiated stop

Closes the double-billing gap (audit finding A1): cancelAnalysis and
deleteAnalysis now read runpod_job_ids from the row and cancel them
directly, since Inngest's cancelOn can't reach job IDs held only in
the cancelled run's own memory.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Full static gate + required live verification

**Files:** none — verification only.

- [ ] **Step 1: Full static gate**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three pass clean (tsc exit 0, lint 0 errors, build `✓ Compiled successfully`).

- [ ] **Step 2: Live test — submit and cancel a real Runpod job**

This is required, not optional (per user instruction) — the fix's entire purpose is an external side effect (stopping GPU billing) that no static check or unit test can observe. Write a one-off script (NOT committed — this repo's auto-save hook can grab and even push stray files; delete it immediately after running and check `git status`/`git log -1` to confirm it wasn't caught, same as the precedent from earlier today):

```ts
// scripts/_scratch-runpod-cancel-verify.ts — ONE-OFF, delete after running.
// Run: npx tsx --env-file=.env.local scripts/_scratch-runpod-cancel-verify.ts
import { submitRunpodJob, cancelRunpodJob } from "../lib/transcription/ivrit-provider";
import { loadTranscriptionConfig } from "../lib/transcription/providers";
import { readFileSync } from "node:fs";

async function main() {
  const cfg = loadTranscriptionConfig();
  // Use any short real audio file already on disk for a live smoke test —
  // e.g. a short local test recording. Base64-encode it.
  const audioPath = process.argv[2];
  if (!audioPath) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/_scratch-runpod-cancel-verify.ts <path-to-short-audio-file>");
    process.exit(1);
  }
  const audioBase64 = readFileSync(audioPath).toString("base64");

  console.log("Submitting a real Runpod job...");
  const jobId = await submitRunpodJob(audioBase64, cfg);
  console.log(`Submitted job ${jobId}`);

  console.log("Cancelling it immediately...");
  await cancelRunpodJob(jobId, cfg);

  console.log("Checking Runpod's own status endpoint to confirm cancellation...");
  const statusRes = await fetch(`${cfg.runpodBaseUrl}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${cfg.runpodApiKey}` },
  });
  const status = await statusRes.json();
  console.log("Runpod status response:", JSON.stringify(status, null, 2));
  console.log(
    status.status === "CANCELLED"
      ? "\n✓ CONFIRMED: job shows CANCELLED on Runpod's own status endpoint."
      : `\n✗ Job status is "${status.status}", not CANCELLED — investigate before merging.`
  );
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
```

Run it against any short real audio file available (e.g. a test recording used elsewhere in this repo, or any short mp3/wav on disk), passing its path as the one CLI argument. Confirm the printed Runpod status is `CANCELLED` (or Runpod's equivalent terminal-cancelled state — check the actual response shape, since exact status strings should be read from the live response rather than assumed).

- [ ] **Step 3: Delete the scratch script and confirm it wasn't auto-committed**

Run: `cd "C:\Users\PC\Claude\salezy" && rm scripts/_scratch-runpod-cancel-verify.ts && git status --short && git log -3 --oneline`
Expected: clean status; if an auto-save commit grabbed the script before deletion (check `git log`), remove it the same way as the precedent earlier today — `git reset --hard` if unpushed and containing only that file, or a follow-up delete commit if it already reached `origin`.

- [ ] **Step 4: Report results**

Summarize for the user: static gate results, and the live-test outcome (confirmed cancelled via Runpod's status endpoint, or not — if not, this is a blocker, stop and report rather than proceeding to Task 7).

---

## Explicitly out of scope

The periodic-reconciliation/sweeper-job idea (defense-in-depth for a cancel call that itself fails) — noted in the spec as considered-and-rejected for now, not part of this plan. Everything else from the 2026-07-09 audit unrelated to this branch.

## Do not merge

Per explicit user instruction: **do not merge `feature/fix-runpod-timeout` into `main` without the user's explicit "אשר merge."** Stop after Task 6 and report — branch green, live-verified, ready for the user's merge decision.
