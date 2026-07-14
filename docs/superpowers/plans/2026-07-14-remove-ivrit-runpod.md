# Remove ivrit/Runpod Transcription Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the ivrit.ai/Runpod transcription provider entirely and consolidate the pipeline on a single, direct OpenAI Whisper (`gpt-4o-transcribe-diarize`) path — no provider abstraction, no polling, no fallback branching.

**Architecture:** Delete the `lib/transcription/` provider-abstraction directory outright. The two pieces of logic inside it that are still genuinely needed by the (already-live) OpenAI path — `formatDiarizedSegments`/`DiarizedSegment` (used by `lib/whisper.ts`) — move into `lib/whisper.ts`, their only remaining caller. `lib/inngest/functions.ts` collapses its two-branch `if (providerPref !== "ivrit") { ... } else { ... }` transcription block into one straight-line `step.run("transcribe", ...)`. `app/actions.ts` drops the direct-Runpod-cancel side channel and goes back to a plain Inngest cancel event. `lib/audio.ts` keeps its Whisper-specific chunking (25MB per-request limit still applies with OpenAI-only) but drops the Runpod-specific tighter chunk-size constants and the now-unused per-call override parameter.

**Tech Stack:** Next.js 16 / TypeScript, Inngest, OpenAI `gpt-4o-transcribe-diarize`.

**Not in scope for this plan (flagged for a separate decision, not done here):**
- Dropping the `runpod_job_ids` / `transcription_provider` DB columns (schema changes are higher blast-radius than code deletion — see "Open questions" at the end).
- Deleting the *historical* planning docs under `docs/superpowers/plans/` and `docs/superpowers/specs/` that describe how ivrit/Runpod was originally built (`2026-07-06-*`, `2026-07-10-ivrit-runpod-cancel-on-stop*`) — this repo's established convention is to keep those as a durable record of what was built and why, not delete them once the feature they describe changes. Only *live* docs (CLAUDE.md, README.md, OPS.md, legal pages) get updated, since those are current-state claims.
- Removing `RUNPOD_*` / `TRANSCRIPTION_PROVIDER` / `IVRIT_TIMEOUT_MS` from Vercel's production environment variables — that's an account-level change outside the repo; flagged as a follow-up, not executed here.

---

### Task 1: `lib/audio.ts` — drop Runpod-specific chunk sizing, simplify `splitIfNeeded`

**Files:**
- Modify: `lib/audio.ts`

**Files/lines currently:**
- `RUNPOD_MAX_RAW_BYTES` (line 20) and `RUNPOD_SEGMENT_SECONDS` (line 33), plus their doc comments — Runpod-only, safe to delete.
- `splitIfNeeded(buffer, fileName, maxBytes = MAX_BYTES, segmentSeconds = SEGMENT_SECONDS)` — the override parameters exist ONLY so `functions.ts` could pass the tighter Runpod limits. With one caller and one limit going forward, the override params are dead weight (YAGNI).

- [ ] **Step 1: Remove the Runpod constants and their comments**

Delete:
```ts
/**
 * Keep each ivrit/Runpod chunk safely under the endpoint's confirmed 10MiB
 * REQUEST BODY limit — NOT a file-size limit like Whisper's. Discovered via a
 * live diagnostic call against the real endpoint, which returned Runpod's own
 * error verbatim: `{"detail":"bad request: body: exceeded max body size of
 * 10MiB"}`. submitRunpodJob() base64-encodes the raw chunk before sending it
 * as JSON, inflating size by ~4/3 — 7MB raw becomes ~9.33MB base64, leaving
 * ~0.67MiB headroom under the 10MiB ceiling for the surrounding JSON
 * structure (language/model/diarize fields).
 */
export const RUNPOD_MAX_RAW_BYTES = 7 * 1024 * 1024;
```
and
```ts
/**
 * Segment length for oversized files split for ivrit/Runpod (seconds) — kept
 * proportionally shorter than SEGMENT_SECONDS to match RUNPOD_MAX_RAW_BYTES's
 * tighter target, with margin for un-converted (higher-bitrate) mp3/wav
 * uploads that skip the 16kHz-mono conversion step (needsConversion returns
 * false for mp3/wav, so splitIfNeeded may run on the ORIGINAL bitrate, not
 * the assumed-16kHz-mono one SEGMENT_SECONDS was tuned for).
 */
export const RUNPOD_SEGMENT_SECONDS = 300;
```

- [ ] **Step 2: Simplify `splitIfNeeded`'s signature (no more override params)**

Change:
```ts
export async function splitIfNeeded(
  buffer: Buffer,
  fileName: string,
  maxBytes: number = MAX_BYTES,
  segmentSeconds: number = SEGMENT_SECONDS
): Promise<AudioChunk[]> {
  if (buffer.length <= maxBytes) {
    return [{ buffer, name: fileName }];
  }
```
to:
```ts
export async function splitIfNeeded(
  buffer: Buffer,
  fileName: string
): Promise<AudioChunk[]> {
  if (buffer.length <= MAX_BYTES) {
    return [{ buffer, name: fileName }];
  }
```
and inside the function body replace the two remaining `segmentSeconds`/`maxBytes` references with `SEGMENT_SECONDS` directly (the `ffmpeg -segment_time` arg).

- [ ] **Step 3: Commit**

```bash
git add lib/audio.ts
git commit -m "refactor(audio): drop Runpod-only chunk sizing, simplify splitIfNeeded"
```

---

### Task 2: `lib/whisper.ts` — inline `formatDiarizedSegments`/`DiarizedSegment` (last consumer)

**Files:**
- Modify: `lib/whisper.ts`

`formatDiarizedSegments` and `DiarizedSegment` currently live in `lib/transcription/providers.ts`, which this task tree deletes in Task 4. `lib/whisper.ts` is their only remaining caller (confirmed by repo-wide search), so the function/type move here directly rather than leaving a one-file "abstraction" behind for a single consumer.

- [ ] **Step 1: Replace the import with an inlined type + function**

Change:
```ts
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { formatDiarizedSegments, type DiarizedSegment } from "@/lib/transcription/providers";
```
to:
```ts
import OpenAI from "openai";
import { toFile } from "openai/uploads";
```

Add, right below the `DiarizedResponse` interface (after line 11):
```ts
/** One diarized segment — the shape gpt-4o-transcribe-diarize returns per speaker turn. */
interface DiarizedSegment {
  speaker?: string;
  text?: string;
}

/**
 * Merge consecutive same-speaker segments into a labeled Hebrew transcript:
 *
 *   דובר 1: שלום, מדבר דני
 *   דובר 2: היי דני, מה שלומך
 *
 * Speaker keys are mapped to `דובר N` by first appearance. Falls back to plain
 * text when no segments are present.
 */
function formatDiarizedSegments(
  segments: DiarizedSegment[] | undefined,
  fallbackText?: string
): string {
  if (!segments?.length) {
    return (fallbackText ?? "").trim();
  }

  const speakerNames = new Map<string, string>();
  const labelFor = (raw: string | undefined): string => {
    const key = raw ?? "?";
    if (!speakerNames.has(key)) {
      speakerNames.set(key, `דובר ${speakerNames.size + 1}`);
    }
    return speakerNames.get(key)!;
  };

  const lines: string[] = [];
  let lastSpeaker: string | null = null;
  for (const seg of segments) {
    const text = (seg.text ?? "").trim();
    if (!text) continue;
    const label = labelFor(seg.speaker);
    if (label === lastSpeaker) {
      lines[lines.length - 1] += ` ${text}`;
    } else {
      lines.push(`${label}: ${text}`);
      lastSpeaker = label;
    }
  }
  return lines.join("\n").trim();
}
```

The `DiarizedResponse` interface's own `segments?: DiarizedSegment[]` field keeps working unchanged since `DiarizedSegment` is now a local type.

- [ ] **Step 2: Commit**

```bash
git add lib/whisper.ts
git commit -m "refactor(whisper): inline formatDiarizedSegments (last consumer of lib/transcription/providers)"
```

---

### Task 3: `lib/inngest/functions.ts` — collapse to a single OpenAI-only transcribe step

**Files:**
- Modify: `lib/inngest/functions.ts`

This is the core of the removal. Replace the imports, `prepareAudio`'s `chunkLimits` parameter, and the entire branching transcription block (current lines 1–29 imports, 116–152 `prepareAudio`, 237–381 transcription branch).

- [ ] **Step 1: Replace the top imports**

Change:
```ts
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  splitIfNeeded,
  convertToMp3,
  checkHasSpeech,
  RUNPOD_MAX_RAW_BYTES,
  RUNPOD_SEGMENT_SECONDS,
  type AudioChunk,
} from "@/lib/audio";
import {
  submitRunpodJob,
  checkRunpodJobs,
  cancelRunpodJobs,
  aggregatePollResults,
  type RunpodJobRecord,
  type RunpodPollVerdict,
} from "@/lib/transcription/ivrit-provider";
import { transcribeWithOpenAI } from "@/lib/transcription/openai-provider";
import {
  loadTranscriptionConfig,
  computeRunpodPollCeilingMs,
  RUNPOD_POLL_INTERVAL_MS,
  mergeResults,
  type TranscriptionResult,
} from "@/lib/transcription/providers";
import { reasonAboutCall, synthesizeAnalysis } from "@/lib/analysis";
```
to:
```ts
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitIfNeeded, convertToMp3, checkHasSpeech, type AudioChunk } from "@/lib/audio";
import { transcribeAudio } from "@/lib/whisper";
import { reasonAboutCall, synthesizeAnalysis } from "@/lib/analysis";
```

(`computeCustomerPersonality`, `needsConversion`, `TERMINAL_STATUSES` imports below stay unchanged.)

- [ ] **Step 2: Simplify `prepareAudio` — drop the `chunkLimits` parameter**

Change:
```ts
async function prepareAudio(
  admin: ReturnType<typeof createAdminClient>,
  analysisId: string,
  filePath: string,
  chunkLimits?: { maxBytes: number; segmentSeconds: number }
): Promise<
  | { ok: false; reason: string }
  | { ok: true; chunks: AudioChunk[]; durationSeconds: number }
> {
```
to:
```ts
async function prepareAudio(
  admin: ReturnType<typeof createAdminClient>,
  analysisId: string,
  filePath: string
): Promise<
  | { ok: false; reason: string }
  | { ok: true; chunks: AudioChunk[]; durationSeconds: number }
> {
```

And change:
```ts
  const chunks = chunkLimits
    ? await splitIfNeeded(buffer, fileName, chunkLimits.maxBytes, chunkLimits.segmentSeconds)
    : await splitIfNeeded(buffer, fileName);
  return { ok: true, chunks, durationSeconds: speechCheck.durationSeconds };
```
to:
```ts
  const chunks = await splitIfNeeded(buffer, fileName);
  return { ok: true, chunks, durationSeconds: speechCheck.durationSeconds };
```

Also update the doc comment directly above `prepareAudio` (currently describes it as "shared by the ivrit submission step AND the OpenAI fallback step"):
```ts
/**
 * Guard + convert + split result for one raw upload, used by the transcribe
 * step below. ffmpeg output (Buffers) can't cross an Inngest step boundary
 * (see lib/audio.ts), so this always runs fresh inside the step that needs it.
 */
```

- [ ] **Step 3: Replace the entire transcription branch**

Replace this whole block (the `let transcript: string; if (initialCompletedSteps.includes("transcribe") && row.transcript) { ... } else { ... }` — everything from the OpenAI-only comment through the closing of the ivrit `else` branch, i.e. the full ~145-line block covering both the `providerPref !== "ivrit"` path and the `ivrit` path) with:

```ts
    let transcript: string;
    if (initialCompletedSteps.includes("transcribe") && row.transcript) {
      transcript = row.transcript;
    } else {
      const transcribeResult = await step.run("transcribe", async () => {
        const prep = await prepareAudio(admin, analysisId, filePath);
        if (!prep.ok) {
          await markNoSpeech(admin, analysisId, prep.reason);
          return { ok: false as const };
        }
        const parts = await Promise.all(
          prep.chunks.map((chunk) => transcribeAudio(chunk.buffer, chunk.name))
        );
        const text = parts.join("\n").trim();
        if (text.length < MIN_TRANSCRIPT_CHARS) {
          await markNoSpeech(
            admin,
            analysisId,
            `no_speech_detected: reason=empty_transcript length=${text.length}`
          );
          return { ok: false as const };
        }
        await persistProgress(admin, analysisId, {
          transcript: text,
          transcription_provider: "openai",
          completed_steps: [...initialCompletedSteps, "transcribe"],
        });
        return { ok: true as const, transcript: text };
      });
      if (!transcribeResult.ok) {
        return { analysisId, status: "no_speech_detected" };
      }
      transcript = transcribeResult.transcript;
    }
```

- [ ] **Step 4: Commit**

```bash
git add lib/inngest/functions.ts
git commit -m "refactor(pipeline): collapse transcription to a single OpenAI-only step, remove ivrit/Runpod branch"
```

---

### Task 4: Delete `lib/transcription/` entirely

**Files:**
- Delete: `lib/transcription/ivrit-provider.ts`
- Delete: `lib/transcription/openai-provider.ts`
- Delete: `lib/transcription/providers.ts`

Every export these three files had that's still needed (`formatDiarizedSegments`/`DiarizedSegment`) was already relocated into `lib/whisper.ts` in Task 2. Everything else (`submitRunpodJob`, `checkRunpodJobs`, `cancelRunpodJobs`, `aggregatePollResults`, `RunpodJobRecord`, `RunpodPollVerdict`, `loadTranscriptionConfig`, `TranscriptionConfig`, `computeRunpodPollCeilingMs`, `RUNPOD_POLL_INTERVAL_MS`, `DEFAULT_POLL_CEILING_MS`, `mergeResults`, `TranscriptionResult`, `transcribeWithOpenAI`) has no remaining caller after Task 3 — confirmed by the repo-wide search run before this plan was written.

- [ ] **Step 1: Delete the directory**

```bash
git rm -r lib/transcription
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: delete lib/transcription (ivrit/Runpod provider abstraction, no longer referenced)"
```

---

### Task 5: `app/actions.ts` — drop the direct-Runpod-cancel side channel

**Files:**
- Modify: `app/actions.ts`

`cancelAnalysis` and `deleteAnalysis` currently cancel any in-flight Runpod job directly (in addition to sending the normal Inngest cancel event), because a Runpod job ID lives outside Inngest's own cancellation reach. With Runpod gone, both functions go back to sending just the cancel event — there's no separate cancelable job to reach into anymore (an in-flight OpenAI Whisper call was never cancelable here either, before or after ivrit existed).

- [ ] **Step 1: Remove the two imports**

Delete:
```ts
import { cancelRunpodJobs, type RunpodJobRecord } from "@/lib/transcription/ivrit-provider";
import { loadTranscriptionConfig } from "@/lib/transcription/providers";
```

- [ ] **Step 2: Simplify `cancelAnalysis`**

Change:
```ts
  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, runpod_job_ids")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  if (data.status !== ...) { // (exact surrounding condition unchanged)
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
```
to:
```ts
  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  if (data.status !== ...) { // (exact surrounding condition unchanged)
    throw new Error("Analysis is not currently running");
  }

  await inngest.send({ name: "analysis/cancel-requested", data: { analysisId } });
```

(Read the exact current condition/surrounding lines from the file at edit time — this step only removes the `runpod_job_ids` column from the `select`, deletes the comment block, and replaces the `Promise.all([...])` with a single `inngest.send(...)` call; every other line in this function is unchanged.)

- [ ] **Step 3: Simplify `deleteAnalysis`**

Same pattern at the second occurrence: remove `runpod_job_ids` from its `select(...)` call, delete the `// See cancelAnalysis above...` comment, and replace
```ts
    const jobRecords = data.runpod_job_ids as RunpodJobRecord[] | null;
    await Promise.all([
      inngest.send({ name: "analysis/cancel-requested", data: { analysisId } }),
      jobRecords?.length ? cancelRunpodJobs(jobRecords, loadTranscriptionConfig()) : Promise.resolve(),
    ]);
```
with
```ts
    await inngest.send({ name: "analysis/cancel-requested", data: { analysisId } });
```

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts
git commit -m "refactor(actions): drop direct Runpod-cancel side channel from cancelAnalysis/deleteAnalysis"
```

---

### Task 6: Delete the now-dead Runpod verification script

**Files:**
- Delete: `scripts/verify-runpod-polling.mjs`

This script is a standalone, network-free regression test for `computeRunpodPollCeilingMs` and `aggregatePollResults` — both deleted in Task 4. It has no purpose without them.

- [ ] **Step 1: Delete**

```bash
git rm scripts/verify-runpod-polling.mjs
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: delete verify-runpod-polling.mjs (tests logic removed in this branch)"
```

---

### Task 7: Update live docs (CLAUDE.md, README.md, docs/OPS.md)

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/OPS.md`

- [ ] **Step 1: `CLAUDE.md`**

Change (tech-stack bullet):
```
- Transcription: ivrit.ai/whisper-large-v3 + pyannote on Runpod serverless (primary, polled across step.sleep-separated Inngest steps with a duration-scaled ceiling — see `computeRunpodPollCeilingMs`), OpenAI `gpt-4o-transcribe-diarize` fallback (auto-triggered + Runpod job cancelled on failure/timeout) — both Hebrew, speaker-labeled (`דובר N:`). Provider abstraction in `lib/transcription/`, selected via `TRANSCRIPTION_PROVIDER`
```
to:
```
- Transcription: OpenAI `gpt-4o-transcribe-diarize`, Hebrew, speaker-labeled (`דובר N:`) — `lib/whisper.ts`
```

Change ("Current Scope" item 2):
```
2. Inngest pipeline: convert (if needed) → transcribe with ivrit.ai on Runpod (OpenAI `gpt-4o-transcribe-diarize` fallback) → reason with Claude Sonnet 4.6 → synthesize to JSON with GPT-4o (Zod-validated against `AnalysisResult`) → DISC customer-personality scoring (dedicated quantitative engine, `lib/disc.ts` — not LLM-holistic)
```
to:
```
2. Inngest pipeline: convert (if needed) → transcribe with OpenAI `gpt-4o-transcribe-diarize` → reason with Claude Sonnet 4.6 → synthesize to JSON with GPT-4o (Zod-validated against `AnalysisResult`) → DISC customer-personality scoring (dedicated quantitative engine, `lib/disc.ts` — not LLM-holistic)
```

- [ ] **Step 2: `README.md`**

Change:
```
- Transcription: ivrit.ai/whisper-large-v3 + pyannote on Runpod (primary), OpenAI `gpt-4o-transcribe-diarize` (fallback)
```
to:
```
- Transcription: OpenAI `gpt-4o-transcribe-diarize`
```

Remove these three lines from the env var setup list:
```
   RUNPOD_API_KEY=
   RUNPOD_ENDPOINT_ID=
   RUNPOD_BASE_URL=
   TRANSCRIPTION_PROVIDER=
```

- [ ] **Step 3: `docs/OPS.md`**

Remove the entire `## Transcription provider` section:
```
## Transcription provider

`TRANSCRIPTION_PROVIDER` env var: `"ivrit"` routes through Runpod (primary) with automatic fallback to OpenAI on timeout/failure; unset or any other value uses OpenAI only (`lib/transcription/providers.ts`'s `loadTranscriptionConfig`). Requires `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` to be set wherever `ivrit` is active.
```

(Read the file at edit time to confirm exact section boundaries before deleting — don't touch the surrounding "Data retention" / migration-list sections.)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md docs/OPS.md
git commit -m "docs: remove ivrit/Runpod references from CLAUDE.md, README.md, OPS.md"
```

---

### Task 8: Update legal pages/docs (Runpod is no longer a subprocessor)

**Files:**
- Modify: `app/(legal)/dpa/page.tsx`
- Modify: `app/(legal)/privacy/page.tsx`
- Modify: `docs/legal/dpa.md`
- Modify: `docs/legal/privacy-policy.md`
- Modify: `docs/legal/data-inventory.md`

These are live, user-facing legal pages, not historical planning docs — once Runpod stops processing any data, listing it as an active subprocessor becomes actively inaccurate (a live compliance issue), not just style drift.

- [ ] **Step 1: `app/(legal)/dpa/page.tsx`**

Remove this line from the subprocessor array:
```ts
  { name: "Runpod, Inc. (מודל ivrit.ai)", role: "תמלול עברית — רק כשמופעל", region: "לאמת אזור GPU לפני הפעלה" },
```

- [ ] **Step 2: `app/(legal)/privacy/page.tsx`**

Remove this table row:
```tsx
          <tr>
            <td>Runpod (ivrit.ai)</td>
            <td>תמלול עברית ייעודי — רק כאשר ערוץ זה מופעל</td>
            <td>קובץ האודיו המלא</td>
          </tr>
```

- [ ] **Step 3: `docs/legal/dpa.md`**

Remove the Runpod row from its subprocessor table:
```
| Runpod, Inc. (מודל ivrit.ai) | תמלול עברית — רק כשמופעל | ⚖️ [לאמת אזור GPU לפני הפעלה] |
```

- [ ] **Step 4: `docs/legal/privacy-policy.md`**

Remove the Runpod row from its subprocessor table:
```
| Runpod (ivrit.ai) | תמלול עברית ייעודי — **רק כאשר ערוץ זה מופעל** | קובץ האודיו המלא | ⚖️ יש להשלים לפני הפעלה בפרודקשן |
```

- [ ] **Step 5: `docs/legal/data-inventory.md`**

Remove row 9 (`runpod_job_ids`):
```
| 9 | `runpod_job_ids` (מזהי משימות תמלול) | ערוץ ivrit | Postgres `analyses.runpod_job_ids` | Runpod | מאופס בסיום התמלול | אוטומטי בסיום/ביטול |
```

(Leave the row's `#` numbering as-is or renumber trailing rows — check the file at edit time for whether numbering is treated as a stable ID elsewhere; if not, renumbering rows 10+ down by one is fine.)

- [ ] **Step 6: Commit**

```bash
git add "app/(legal)/dpa/page.tsx" "app/(legal)/privacy/page.tsx" docs/legal/dpa.md docs/legal/privacy-policy.md docs/legal/data-inventory.md
git commit -m "docs(legal): remove Runpod as a subprocessor — no longer processes any data"
```

---

### Task 9: Quality gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: clean exit, zero errors (in particular: zero "Cannot find module '@/lib/transcription/...'" errors anywhere).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean exit, zero warnings (in particular: zero unused-import warnings on the files touched above).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean production build. This is the strongest signal here since it also exercises the Next.js Server/Client boundary checks and static analysis this repo has been bitten by before.

- [ ] **Step 4: Grep sanity check**

Run: `grep -rli "runpod\|ivrit" --include="*.ts" --include="*.tsx" --include="*.mjs" . | grep -v node_modules`
Expected: zero matches in live code/scripts. (Historical `docs/superpowers/plans/*.md` and `docs/superpowers/specs/*.md` matches are expected and fine — those are deliberately out of scope, see the plan header.)

---

## Open questions for you before/after execution

1. **DB columns** — `runpod_job_ids` and `transcription_provider` stay in the schema (not touched by this plan). `runpod_job_ids` becomes fully dead going forward (nothing writes to it anymore). Do you want a follow-up migration to drop it? `transcription_provider` will just always be written as `'openai'` going forward — worth keeping as-is (harmless, matches its existing default) unless you'd rather drop it too.
2. **Vercel/`.env.local` env vars** — `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `RUNPOD_BASE_URL`, `TRANSCRIPTION_PROVIDER`, `IVRIT_TIMEOUT_MS` become unused by the code after this branch merges. Want me to remove them from `.env.local` and from Vercel's production env once this ships, or leave them (harmless if unused, but also not "clean")?
3. **Historical plan/spec docs** — confirmed out of scope per this repo's established convention (kept as a record, e.g. the 2026-07-09 full-audit plan was never deleted after the features it planned changed). Flagging again in case you'd actually prefer those deleted too, given your "don't want dead code cluttering the repo" framing — my read is that applies to *code*, not to historical decision records, but it's your call.
