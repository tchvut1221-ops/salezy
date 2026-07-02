# Pre-Transcription Audio Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the pipeline from fabricating a full sales-call analysis (fake score, fake deal stage, fake quotes, sometimes even a fake company name) when the uploaded recording has no real speech — and do it *before* the expensive `gpt-4o-transcribe-diarize` call runs, not after.

**Architecture:** A cheap local ffmpeg `volumedetect` check (`checkHasSpeech`) runs inside the existing `"transcribe"` Inngest step, on the raw downloaded buffer, before format conversion or transcription. If the file is empty/too short, has no audio stream, or is silent, the step short-circuits: it writes a new `no_speech_detected` status directly to the DB and returns a sentinel that makes the outer Inngest function return early, skipping conversion, transcription, and both AI stages entirely. A second, cheaper guard after transcription catches the rarer case where real audio (e.g. music/noise) passed the ffmpeg check but Whisper still returned nothing usable — that one still cost the transcription call, but it stops the *even more expensive* two-stage AI analysis from running on garbage. Claude's system prompt also gets an explicit "don't fabricate" instruction as a last line of defense for thin-but-nonzero transcripts.

**Tech Stack:** ffmpeg (via the already-bundled `ffmpeg-static`, no new dependency), TypeScript/Inngest steps, Supabase (migration + status column), Next.js UI. Verification uses a plain `.mjs` spike script (matching the existing `scripts/*.mjs` convention — this repo has no test runner) plus the existing `scripts/watch-analyses.mjs` for live status-transition verification.

---

## Why ffmpeg `volumedetect` instead of `ffprobe-static`

The repo already bundles `ffmpeg-static` (used in `lib/audio.ts`) and exempts it from webpack bundling in `next.config.ts`. `ffmpeg -i <file> -af volumedetect -f null -` reports **both** the stream duration (`Duration: HH:MM:SS.ms` in stderr) **and** the mean volume (`mean_volume: X dB` in stderr) from a single invocation, decoding whatever container/codec is thrown at it. That covers all three checks the user asked for (has audio stream / duration / volume) without adding `ffprobe-static` as a new dependency or touching `next.config.ts`.

## Status values before/after

Before: `"uploaded" | "converting" | "transcribing" | "analyzing" | "completed" | "failed"` (`types/index.ts:1-7`, enforced by a check constraint in `supabase/migrations/0003_add_converting_status.sql`).

After: adds `"no_speech_detected"` — a new terminal status, sibling to `"failed"`, with its own friendly Hebrew message instead of the generic "אירעה שגיאה" failure message.

---

### Task 1: Prove the ffmpeg detection logic with a standalone spike script

**Files:**
- Create: `scripts/verify-audio-guard.mjs`

This validates the exact ffmpeg command and regex parsing against real synthetic audio (silence, too-short, and a valid tone) before it's ported into the TypeScript pipeline. No API keys or network calls involved — pure local ffmpeg.

- [ ] **Step 1: Write the script with a stubbed `checkHasSpeech`**

```javascript
/**
 * Standalone spike/regression check for the pre-transcription silence guard
 * (see lib/audio.ts checkHasSpeech). Generates synthetic audio fixtures with
 * ffmpeg's lavfi sources and confirms the ffmpeg volumedetect command + the
 * duration/mean_volume regexes correctly classify each one — before any of
 * this runs against real uploads or costs a single OpenAI token.
 *
 * Usage:
 *   node scripts/verify-audio-guard.mjs
 *   node scripts/verify-audio-guard.mjs --fixture-only path/to/out.wav
 *     (generates one 5s silent WAV at the given path and exits — for
 *     manually uploading through the app's UI to test the full pipeline)
 */
import { spawn } from "node:child_process";
import { promises as fs, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const MIN_DURATION_SECONDS = 1;
const SILENCE_THRESHOLD_DB = -50;

function captureFfmpeg(args) {
  return new Promise((resolve, reject) => {
    try {
      chmodSync(ffmpegPath, 0o755);
    } catch {
      // best-effort
    }
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", () => resolve(stderr));
  });
}

async function checkHasSpeech() {
  throw new Error("not implemented");
}

async function generate(workDir, name, lavfi, seconds) {
  const outPath = path.join(workDir, name);
  const stderr = await captureFfmpeg([
    "-f", "lavfi",
    "-i", lavfi,
    "-t", String(seconds),
    "-ac", "1",
    "-ar", "16000",
    outPath,
  ]);
  try {
    await fs.access(outPath);
  } catch {
    throw new Error(`fixture generation failed for ${name}:\n${stderr.slice(-500)}`);
  }
  return outPath;
}

async function main() {
  if (!ffmpegPath) {
    console.error("❌ ffmpeg binary not found (ffmpeg-static)");
    process.exit(1);
  }

  const fixtureOnlyIdx = process.argv.indexOf("--fixture-only");
  if (fixtureOnlyIdx !== -1) {
    const outPath = path.resolve(process.argv[fixtureOnlyIdx + 1] ?? "silent-test.wav");
    await captureFfmpeg([
      "-f", "lavfi",
      "-i", "anullsrc=r=16000:cl=mono",
      "-t", "5",
      "-ac", "1",
      "-ar", "16000",
      outPath,
    ]);
    console.log(`✅ wrote 5s silent WAV fixture to ${outPath}`);
    return;
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "salezy-guard-check-"));
  let failures = 0;

  try {
    const cases = [
      { name: "too-short.wav", lavfi: "anullsrc=r=16000:cl=mono", seconds: 0.5, expect: "empty" },
      { name: "silent.wav", lavfi: "anullsrc=r=16000:cl=mono", seconds: 5, expect: "silent" },
      { name: "tone.wav", lavfi: "sine=frequency=440:sample_rate=16000", seconds: 5, expect: null },
    ];

    for (const c of cases) {
      const filePath = await generate(workDir, c.name, c.lavfi, c.seconds);
      const result = await checkHasSpeech(filePath);
      const pass = c.expect === null ? result.ok === true : result.reason === c.expect;
      console.log(
        `${pass ? "✅" : "❌"} ${c.name}: ok=${result.ok} reason=${result.reason ?? "-"} ` +
          `duration=${result.durationSeconds}s meanVolume=${result.meanVolumeDb}dB`
      );
      if (!pass) failures++;
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} case(s) failed`);
    process.exit(1);
  }
  console.log("\n✅ all cases passed");
}

main().catch((err) => {
  console.error("❌", err?.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `node scripts/verify-audio-guard.mjs`
Expected: crashes with `❌ not implemented` (uncaught rejection from the stub) — proves the harness actually exercises the function instead of trivially passing.

- [ ] **Step 3: Implement the real `checkHasSpeech`**

Replace the stub with:

```javascript
async function checkHasSpeech(filePath) {
  const stderr = await captureFfmpeg([
    "-i", filePath,
    "-af", "volumedetect",
    "-f", "null",
    "-",
  ]);

  const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/);
  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : null;

  const volumeMatch = stderr.match(/mean_volume:\s*(-inf|-?\d+(?:\.\d+)?)\s*dB/);
  const meanVolumeDb = volumeMatch
    ? volumeMatch[1] === "-inf" ? -Infinity : Number(volumeMatch[1])
    : null;

  if (durationSeconds === null || durationSeconds < MIN_DURATION_SECONDS) {
    return { ok: false, durationSeconds, meanVolumeDb, reason: "empty" };
  }
  if (meanVolumeDb === null) {
    return { ok: false, durationSeconds, meanVolumeDb, reason: "no_audio" };
  }
  if (meanVolumeDb <= SILENCE_THRESHOLD_DB) {
    return { ok: false, durationSeconds, meanVolumeDb, reason: "silent" };
  }
  return { ok: true, durationSeconds, meanVolumeDb };
}
```

- [ ] **Step 4: Run it again, confirm it passes**

Run: `node scripts/verify-audio-guard.mjs`
Expected:
```
✅ too-short.wav: ok=false reason=empty duration=0.5s meanVolume=null...
✅ silent.wav: ok=false reason=silent duration=5s meanVolume=-91...
✅ tone.wav: ok=true reason=- duration=5s meanVolume=-4.xx...

✅ all cases passed
```
(Exact dB numbers will vary slightly by ffmpeg build — what matters is `reason` matching and the final "all cases passed" line.)

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-audio-guard.mjs
git commit -m "test: add standalone spike script proving the ffmpeg silence-detection approach"
```

---

### Task 2: Port `checkHasSpeech` into `lib/audio.ts`

**Files:**
- Modify: `lib/audio.ts:106-127` (insert new function + helper between `splitIfNeeded` and `runFfmpeg`)

The regex patterns and thresholds below are copied verbatim from the proven `scripts/verify-audio-guard.mjs` (Task 1) — same command, same parsing, now typed and wired to the real buffer-based API the rest of `lib/audio.ts` uses.

- [ ] **Step 1: Add the constants, types, and functions**

Insert after line 106 (`}` closing `splitIfNeeded`) and before line 108 (`function runFfmpeg`):

```typescript
/** Minimum audio duration to be considered a real recording (seconds). */
const MIN_DURATION_SECONDS = 1;
/** Mean volume at or below this is treated as silence (dBFS). */
const SILENCE_THRESHOLD_DB = -50;

export interface SpeechCheckResult {
  ok: boolean;
  durationSeconds: number | null;
  meanVolumeDb: number | null;
  reason?: "empty" | "no_audio" | "silent";
}

/**
 * Cheap local pre-check (ffmpeg volumedetect, no API calls) that catches
 * empty, truncated, silent, or audio-less uploads before the expensive
 * transcription step runs. Must run BEFORE transcribeAudio/splitIfNeeded —
 * those cost tokens, this doesn't. Command and parsing proven correct in
 * scripts/verify-audio-guard.mjs. MUST run inside an Inngest step (uses
 * ffmpeg + the OS temp dir).
 */
export async function checkHasSpeech(
  buffer: Buffer,
  fileName: string
): Promise<SpeechCheckResult> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary not found (ffmpeg-static)");
  }

  const ext = path.extname(fileName) || ".bin";
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "salezy-check-"));
  const inputPath = path.join(workDir, `input${ext}`);

  try {
    await fs.writeFile(inputPath, buffer);
    const stderr = await captureFfmpeg([
      "-i", inputPath,
      "-af", "volumedetect",
      "-f", "null",
      "-",
    ]);

    const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/);
    const durationSeconds = durationMatch
      ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
      : null;

    const volumeMatch = stderr.match(/mean_volume:\s*(-inf|-?\d+(?:\.\d+)?)\s*dB/);
    const meanVolumeDb = volumeMatch
      ? volumeMatch[1] === "-inf"
        ? -Infinity
        : Number(volumeMatch[1])
      : null;

    if (durationSeconds === null || durationSeconds < MIN_DURATION_SECONDS) {
      return { ok: false, durationSeconds, meanVolumeDb, reason: "empty" };
    }
    if (meanVolumeDb === null) {
      return { ok: false, durationSeconds, meanVolumeDb, reason: "no_audio" };
    }
    if (meanVolumeDb <= SILENCE_THRESHOLD_DB) {
      return { ok: false, durationSeconds, meanVolumeDb, reason: "silent" };
    }
    return { ok: true, durationSeconds, meanVolumeDb };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

/**
 * Like runFfmpeg, but resolves with stderr text instead of rejecting on a
 * non-zero exit — checkHasSpeech needs to read ffmpeg's diagnostic output
 * (Duration/mean_volume) even when the input is malformed enough that ffmpeg
 * exits non-zero.
 */
function captureFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      chmodSync(ffmpegPath as string, 0o755);
    } catch {
      // best-effort; if the path is wrong spawn() will surface the real error
    }
    const proc = spawn(ffmpegPath as string, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", () => resolve(stderr));
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/audio.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/audio.ts
git commit -m "feat: add checkHasSpeech pre-transcription silence/empty-audio guard"
```

---

### Task 3: Add the `no_speech_detected` status (DB + types + UI)

**Files:**
- Create: `supabase/migrations/0006_add_no_speech_status.sql`
- Modify: `types/index.ts:1-7`
- Modify: `components/salezy/analysis-view.tsx:31` and `:118-136`

- [ ] **Step 1: Write the migration**

```sql
-- Salezy: allow the 'no_speech_detected' status (pre-transcription guard —
-- empty/silent uploads short-circuit here instead of running a fabricated
-- analysis on nothing).
-- Run this in the Supabase SQL Editor.

alter table public.analyses
  drop constraint if exists analyses_status_check;

alter table public.analyses
  add constraint analyses_status_check
  check (status in ('uploaded','converting','transcribing','analyzing','completed','failed','no_speech_detected'));
```

Save as `supabase/migrations/0006_add_no_speech_status.sql`.

⚠️ This migration must be applied to the production Supabase project (via the SQL Editor, or `node --env-file=.env.local scripts/apply-migrations.mjs` / `migrate.mjs` if those scripts run pending files automatically — check their contents before relying on that) **before** Task 4's code ships, otherwise every no-speech upload will fail the CHECK constraint. Get explicit confirmation before running anything against the production database.

- [ ] **Step 2: Update the status type**

In `types/index.ts:1-7`, change:

```typescript
export type AnalysisStatus =
  | "uploaded"
  | "converting"
  | "transcribing"
  | "analyzing"
  | "completed"
  | "failed";
```

to:

```typescript
export type AnalysisStatus =
  | "uploaded"
  | "converting"
  | "transcribing"
  | "analyzing"
  | "completed"
  | "failed"
  | "no_speech_detected";
```

- [ ] **Step 3: Add it to the UI's terminal-state list**

In `components/salezy/analysis-view.tsx:31`, change:

```typescript
const TERMINAL: AnalysisStatus[] = ["completed", "failed"];
```

to:

```typescript
const TERMINAL: AnalysisStatus[] = ["completed", "failed", "no_speech_detected"];
```

- [ ] **Step 4: Add the error-card branch**

In `components/salezy/analysis-view.tsx:118-136`, change:

```tsx
        {analysis.status === "failed" ? (
          <div className="mt-6 rounded-lg border border-score-low/30 bg-score-low/10 p-5">
            <p className="text-sm font-medium text-score-low">הניתוח נכשל</p>
            <p className="mt-1 text-sm text-zinc-400">
              נתקלנו בתקלה בעיבוד ההקלטה. אפשר לנסות שוב — הקובץ שכבר העליתם נשמר.
            </p>
            <button
              onClick={onRetry}
              disabled={retrying}
              className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {retrying ? "מתחיל מחדש..." : "נסה שוב"}
            </button>
          </div>
        ) : isReady && analysis.result ? (
          <Result result={analysis.result} />
        ) : (
          <Progress status={analysis.status} />
        )}
```

to:

```tsx
        {analysis.status === "failed" || analysis.status === "no_speech_detected" ? (
          <div className="mt-6 rounded-lg border border-score-low/30 bg-score-low/10 p-5">
            <p className="text-sm font-medium text-score-low">
              {analysis.status === "no_speech_detected" ? "לא זוהה דיבור" : "הניתוח נכשל"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {analysis.status === "no_speech_detected"
                ? "לא זוהה דיבור בהקלטה הזו. ודא שהקובץ מכיל שיחה אמיתית ונסה שוב."
                : "נתקלנו בתקלה בעיבוד ההקלטה. אפשר לנסות שוב — הקובץ שכבר העליתם נשמר."}
            </p>
            <button
              onClick={onRetry}
              disabled={retrying}
              className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {retrying ? "מתחיל מחדש..." : "נסה שוב"}
            </button>
          </div>
        ) : isReady && analysis.result ? (
          <Result result={analysis.result} />
        ) : (
          <Progress status={analysis.status} />
        )}
```

`onRetry` (already defined at `analysis-view.tsx:84-96`) resets `status` to `"uploaded"` and clears `error`, then re-triggers the pipeline — reused as-is, no changes needed there.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts components/salezy/analysis-view.tsx supabase/migrations/0006_add_no_speech_status.sql
git commit -m "feat: add no_speech_detected status (DB constraint, type, UI error card)"
```

---

### Task 4: Wire the guard into the Inngest pipeline

**Files:**
- Modify: `lib/inngest/functions.ts:1-6` (imports), `:37-90` (transcribe step + downstream reference)

This is the task that actually stops the OpenAI transcription call from firing on bad audio, and stops the Claude+GPT-4o analysis from firing on a garbage transcript.

- [ ] **Step 1: Update imports and add the transcript-length constant**

In `lib/inngest/functions.ts:1-6`, change:

```typescript
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitIfNeeded, convertToMp3 } from "@/lib/audio";
import { transcribeAudio } from "@/lib/whisper";
import { reasonAboutCall, synthesizeAnalysis } from "@/lib/analysis";
import { needsConversion } from "@/lib/constants";
```

to:

```typescript
import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitIfNeeded, convertToMp3, checkHasSpeech } from "@/lib/audio";
import { transcribeAudio } from "@/lib/whisper";
import { reasonAboutCall, synthesizeAnalysis } from "@/lib/analysis";
import { needsConversion } from "@/lib/constants";

/**
 * Defense in depth: the ffmpeg volumedetect guard passed (real audio above
 * the silence threshold — e.g. music, background noise, cross-talk) but
 * Whisper still returned next to nothing. Below this length we treat it the
 * same as no_speech_detected rather than let the analysis stage fabricate a
 * report from an empty transcript.
 */
const MIN_TRANSCRIPT_CHARS = 10;
```

- [ ] **Step 2: Replace the `"transcribe"` step body and downstream reference**

In `lib/inngest/functions.ts:51-90`, change:

```typescript
    const transcript = await step.run("transcribe", async () => {
      const { data: file, error } = await admin.storage
        .from("recordings")
        .download(filePath);
      if (error || !file) throw error ?? new Error("הקובץ לא נמצא ב-Storage");

      let buffer: Buffer = Buffer.from(await file.arrayBuffer());
      let fileName = filePath.split("/").pop() ?? "audio.mp3";

      // Convert non-mp3/wav uploads (mp4/mov/ogg/m4a/aac/webm/flac) to mp3 first.
      if (needsConversion(fileName)) {
        await admin
          .from("analyses")
          .update({ status: "converting", error: null })
          .eq("id", analysisId);
        const converted = await convertToMp3(buffer, fileName);
        buffer = converted.buffer;
        fileName = converted.name;
      }

      await admin
        .from("analyses")
        .update({ status: "transcribing", error: null })
        .eq("id", analysisId);

      const chunks = await splitIfNeeded(buffer, fileName);
      // Transcribe chunks concurrently — sequential transcription of a long
      // (split) call overruns the serverless time budget. Promise.all preserves
      // order, so the joined transcript stays in sequence.
      const parts = await Promise.all(
        chunks.map((chunk) => transcribeAudio(chunk.buffer, chunk.name))
      );
      const full = parts.join("\n").trim();

      await admin
        .from("analyses")
        .update({ transcript: full })
        .eq("id", analysisId);
      return full;
    });
```

to:

```typescript
    const transcribeResult = await step.run("transcribe", async () => {
      const { data: file, error } = await admin.storage
        .from("recordings")
        .download(filePath);
      if (error || !file) throw error ?? new Error("הקובץ לא נמצא ב-Storage");

      let buffer: Buffer = Buffer.from(await file.arrayBuffer());
      let fileName = filePath.split("/").pop() ?? "audio.mp3";

      // Pre-transcription guard: catches empty/truncated/silent/audio-less
      // uploads with a cheap local ffmpeg check BEFORE the expensive Whisper
      // call. Runs on the RAW upload — checking after conversion would still
      // burn ffmpeg time re-encoding junk we're about to reject anyway.
      const speechCheck = await checkHasSpeech(buffer, fileName);
      if (!speechCheck.ok) {
        await admin
          .from("analyses")
          .update({
            status: "no_speech_detected",
            error: `no_speech_detected: reason=${speechCheck.reason} duration=${speechCheck.durationSeconds ?? "?"}s meanVolume=${speechCheck.meanVolumeDb ?? "?"}dB`,
          })
          .eq("id", analysisId);
        return { ok: false as const };
      }

      // Convert non-mp3/wav uploads (mp4/mov/ogg/m4a/aac/webm/flac) to mp3 first.
      if (needsConversion(fileName)) {
        await admin
          .from("analyses")
          .update({ status: "converting", error: null })
          .eq("id", analysisId);
        const converted = await convertToMp3(buffer, fileName);
        buffer = converted.buffer;
        fileName = converted.name;
      }

      await admin
        .from("analyses")
        .update({ status: "transcribing", error: null })
        .eq("id", analysisId);

      const chunks = await splitIfNeeded(buffer, fileName);
      // Transcribe chunks concurrently — sequential transcription of a long
      // (split) call overruns the serverless time budget. Promise.all preserves
      // order, so the joined transcript stays in sequence.
      const parts = await Promise.all(
        chunks.map((chunk) => transcribeAudio(chunk.buffer, chunk.name))
      );
      const full = parts.join("\n").trim();

      // Defense in depth: real audio (passed the guard above) but Whisper
      // came back with nothing usable — e.g. pure music/noise. Stop here
      // rather than let the analysis stage fabricate a report.
      if (full.length < MIN_TRANSCRIPT_CHARS) {
        await admin
          .from("analyses")
          .update({
            status: "no_speech_detected",
            error: `no_speech_detected: reason=empty_transcript length=${full.length}`,
          })
          .eq("id", analysisId);
        return { ok: false as const };
      }

      await admin
        .from("analyses")
        .update({ transcript: full })
        .eq("id", analysisId);
      return { ok: true as const, transcript: full };
    });

    if (!transcribeResult.ok) {
      return { analysisId, status: "no_speech_detected" };
    }
    const transcript = transcribeResult.transcript;
```

Everything after this (`step.run("set-analyzing", ...)`, `reasonAboutCall`, `synthesize`, `complete`) stays exactly as-is — `transcript` is still a plain `string` by the time it reaches those.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. In particular, confirm `transcribeResult.ok` narrows the type correctly (TypeScript should complain if `transcribeResult.transcript` is accessed without the `if (!transcribeResult.ok) return ...` guard above it).

- [ ] **Step 4: Read-through structural check**

Re-read the edited `lib/inngest/functions.ts` top to bottom and confirm: `transcribeAudio(...)` (the OpenAI call) is only reachable *after* `speechCheck.ok` is `true`, and `reasonAboutCall`/`synthesizeAnalysis` (the Claude/GPT-4o calls) are only reachable *after* `transcribeResult.ok` is `true`. This is the structural guarantee that no-speech uploads never reach either paid API call.

- [ ] **Step 5: Commit**

```bash
git add lib/inngest/functions.ts
git commit -m "feat: short-circuit the pipeline before transcription/analysis on no-speech audio"
```

---

### Task 5: Add a "don't fabricate" instruction to Claude's reasoning prompt

**Files:**
- Modify: `lib/analysis.ts:165`

Last line of defense: covers transcripts that are short-but-above-`MIN_TRANSCRIPT_CHARS` and technically "content" but not enough for a reliable analysis (e.g. a few disconnected words Whisper picked up from background chatter).

- [ ] **Step 1: Insert the instruction**

In `lib/analysis.ts:165`, change:

```typescript
  const system = `אתה מומחה עולמי לניתוח שיחות מכירה בישראל. אתה מקבל תמלול של שיחה (עם תוויות דוברים) ומנתח אותה לעומק, ומסתמך אך ורק על מה שנאמר בתמלול — בלי להמציא.

נתח בעברית, בצורה מובנית ומנומקת, את כל המימדים הבאים. לכל קביעה הצמד ציטוט קצר או הסבר מהשיחה:
```

to:

```typescript
  const system = `אתה מומחה עולמי לניתוח שיחות מכירה בישראל. אתה מקבל תמלול של שיחה (עם תוויות דוברים) ומנתח אותה לעומק, ומסתמך אך ורק על מה שנאמר בתמלול — בלי להמציא.

⚠️ אם התמלול קצר מדי, לא קוהרנטי, או לא מכיל תוכן מספק לניתוח אמין של שיחת מכירה אמיתית (למשל רעש רקע, מוזיקה, מלמול חד-צדדי, או טקסט חסר משמעות) — אל תמציא ניתוח. במקרה כזה ציין זאת במפורש ובבירור בתקציר המנהלים, תן ציוני confidence וציון כולל נמוכים מאוד (או השמט אותם לגמרי), ואל תמציא ציטוטים, שם חברה, שלב עסקה, או כל פרט שאינו מעוגן ישירות ומילולית בתמלול.

נתח בעברית, בצורה מובנית ומנומקת, את כל המימדים הבאים. לכל קביעה הצמד ציטוט קצר או הסבר מהשיחה:
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this is a string literal change only).

- [ ] **Step 3: Commit**

```bash
git add lib/analysis.ts
git commit -m "feat: instruct Claude to refuse fabrication on thin/incoherent transcripts"
```

---

### Task 6: Live end-to-end verification (manual — do this for real, per the original request)

**Files:** none (verification only)

This is the step that actually proves the fix: no OpenAI transcription spend on a genuinely silent upload, and a real user-facing message instead of a fabricated report.

- [ ] **Step 1: Apply the migration to the environment you're testing against**

Confirm `supabase/migrations/0006_add_no_speech_status.sql` (Task 3) has been applied — check the Supabase SQL Editor or run the project's migration script, whichever this repo's convention is (see `scripts/apply-migrations.mjs` / `scripts/migrate.mjs`). Do not proceed until this is confirmed; otherwise the no-speech DB update in Task 4 will fail the CHECK constraint and the row will just look stuck.

- [ ] **Step 2: Generate a real silent test file**

Run: `node scripts/verify-audio-guard.mjs --fixture-only silent-test.wav`
Expected: `✅ wrote 5s silent WAV fixture to <cwd>/silent-test.wav`

- [ ] **Step 3: Start watching status transitions**

Run in a separate terminal: `node scripts/watch-analyses.mjs`
(It reads `.env.local` itself via `readFileSync` — no `--env-file` flag needed.) Leave it running — it polls every 4s and prints `STATUS row=<id> ... <old> -> <new>` for every status change on the 5 most recent analyses.

- [ ] **Step 4: Upload the silent file through the real app**

Start the dev server (`npm run dev`), log in, and upload `silent-test.wav` through the normal `/upload` flow exactly as a user would.

- [ ] **Step 5: Confirm the expected behavior**

In the `watch-analyses.mjs` terminal, expected output is:
```
NEW row=<id> file="silent-test.wav" status=uploaded
STATUS row=<id> file="silent-test.wav" uploaded -> no_speech_detected
```

Confirm:
- Status jumps straight from `uploaded` to `no_speech_detected` — it must **never** pass through `transcribing`. That transition (or its absence) is the observable proof the Whisper call was skipped, since `status: "transcribing"` is only written *after* `checkHasSpeech` passes (`lib/inngest/functions.ts`, Task 4).
- In the browser, the analysis page shows "לא זוהה דיבור" / "לא זוהה דיבור בהקלטה הזו. ודא שהקובץ מכיל שיחה אמיתית ונסה שוב." — not the generic "הניתוח נכשל" failure card, and not a fabricated result.
- (Optional, if you have dashboard access) Check the OpenAI usage dashboard for `gpt-4o-transcribe-diarize` — no new request should appear correlated with this upload.

- [ ] **Step 6: Clean up the test artifact**

```bash
rm silent-test.wav
```

(No commit needed — this task is verification only, nothing here is a source change.)

---

## Notes for whoever executes this plan

- **Do not push to `main`** after these commits without the user's explicit go-ahead — this repo is GitHub-linked to Vercel, and a push to `main` auto-triggers a production deploy.
- **Do not run the Task 3 migration against production** without explicit confirmation — it's additive/backward-compatible (widens a CHECK constraint) so the risk is low, but it's still a live-database change.
- Task 6 requires a working local dev environment with real Supabase + Inngest + OpenAI credentials in `.env.local`. If that's not available in the execution environment, stop after Task 5 and hand back to the user for the live verification themselves.
