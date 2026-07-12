# Medium/Low Audit Fixes (Items 1-7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 7 remaining Medium/Low code items from the 2026-07-09 audit — everything Critical/High is already merged and live.

**Architecture:** Seven independent, small fixes across the existing codebase, each self-contained with its own commit — no shared plumbing between them (unlike the P1/P2 and cancel-on-stop work earlier today). Per explicit user instruction: process in order, checkpoint (brief status, not a stop-and-ask) after each item.

**Tech Stack:** TypeScript, Next.js config/route conventions, Supabase migration (bucket policy). Static gate (tsc/lint/build) for most items; item 3 (security headers) additionally gets a live browser check since a wrong CSP silently breaks real functionality.

**Spec:** `docs/superpowers/specs/2026-07-10-medium-low-fixes-design.md`

**Starting branch:** `feature/medium-fixes` (off `main`, spec already committed as `ab2fbd9`).

---

### Task 1: `retryAnalysis` status guard

**Files:** Modify `app/actions.ts:23-54`

- [ ] **Step 1: Add the guard**

Find:

```ts
/**
 * Re-runs the pipeline for an analysis that previously `failed`. The original
 * upload still lives in Storage (file_path), so we just reset the row to a clean
 * "uploaded" state, clear the error, and re-emit the Inngest event. Ownership is
 * verified server-side; RLS on the UPDATE is the real guard, the user_id check
 * is defense-in-depth.
 */
export async function retryAnalysis(analysisId: string) {
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

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: "uploaded", error: null })
    .eq("id", analysisId);
  if (updateError) throw updateError;

  await inngest.send({ name: "analysis/requested", data: { analysisId } });
}
```

Replace with:

```ts
/**
 * Re-runs the pipeline for an analysis that previously `failed` or
 * `no_speech_detected`. The original upload still lives in Storage
 * (file_path), so we just reset the row to a clean "uploaded" state, clear
 * the error, and re-emit the Inngest event. Ownership is verified
 * server-side; RLS on the UPDATE is the real guard, the user_id check is
 * defense-in-depth.
 */
export async function retryAnalysis(analysisId: string) {
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
  if (data.status !== "failed" && data.status !== "no_speech_detected") {
    throw new Error("Analysis is not in a retryable state");
  }

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: "uploaded", error: null })
    .eq("id", analysisId);
  if (updateError) throw updateError;

  await inngest.send({ name: "analysis/requested", data: { analysisId } });
}
```

- [ ] **Step 2: Type-check**

Run: `cd "C:\Users\PC\Claude\salezy" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add app/actions.ts
git commit -m "fix: guard retryAnalysis to only run from a retryable status

Siblings (cancelAnalysis, resumeAnalysis) already guard on status;
retryAnalysis had none, so it could reset any status back to
uploaded and re-dispatch the paid pipeline repeatedly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Error-message sanitization

**Files:** Modify `lib/inngest/functions.ts:187-198`

- [ ] **Step 1: Stop storing the raw upstream error**

Find:

```ts
    onFailure: async ({ event }) => {
      // `event` here is the inngest/function.failed event.
      const failure = event as unknown as {
        data: { event: { data: { analysisId: string } }; error?: { message?: string } };
      };
      const analysisId = failure.data.event.data.analysisId;
      const admin = createAdminClient();
      await updateIfNotTerminal(admin, analysisId, {
        status: "failed",
        error: failure.data.error?.message ?? "אירעה שגיאה בעיבוד",
      });
    },
```

Replace with:

```ts
    onFailure: async ({ event }) => {
      // `event` here is the inngest/function.failed event.
      const failure = event as unknown as {
        data: { event: { data: { analysisId: string } }; error?: { message?: string } };
      };
      const analysisId = failure.data.event.data.analysisId;
      const admin = createAdminClient();
      // Raw upstream error (OpenAI/Anthropic/Runpod/ffmpeg) stays server-side
      // only — this row's `error` column is selected with select("*") and
      // shipped to the owning client, so it must never carry provider
      // internals, only a safe generic message.
      console.error(`[analyzeCall] analysis ${analysisId} failed:`, failure.data.error?.message);
      await updateIfNotTerminal(admin, analysisId, {
        status: "failed",
        error: "אירעה שגיאה בעיבוד",
      });
    },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add lib/inngest/functions.ts
git commit -m "fix(security): stop storing raw provider errors in a client-visible column

analyses.error is shipped to the owning client via select(\"*\") on
the analysis page. Logging the real message server-side and storing
a generic one closes this at the single write site.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Security headers

**Files:** Modify `next.config.ts` (full file)

- [ ] **Step 1: Replace the whole file**

Find (current full content of `next.config.ts`):

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep ffmpeg-static out of the webpack bundle. When it's bundled, its
  // `__dirname` is rewritten and the exported binary path resolves to a
  // non-existent location (`/ROOT/.../ffmpeg`), causing `spawn ... ENOENT`.
  // As an external package it stays in node_modules and the path resolves
  // correctly at runtime.
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],

  // The binary itself is spawned by path (not imported), so file tracing
  // doesn't include it automatically — force it into the Inngest function bundle.
  outputFileTracingIncludes: {
    "/api/inngest": ["./node_modules/ffmpeg-static/**"],
  },
};

export default nextConfig;
```

Replace with:

```ts
import type { NextConfig } from "next";

const SUPABASE_ORIGIN = "https://gsfuzqoitldvudkeezwt.supabase.co";
const SUPABASE_WS_ORIGIN = "wss://gsfuzqoitldvudkeezwt.supabase.co";

// Baseline security headers. script-src/style-src need 'unsafe-inline' for
// Next's hydration bootstrap and Tailwind's inline styles — a nonce-based CSP
// would need per-request nonce generation in proxy.ts, a materially bigger
// change not justified for this baseline-hardening pass. Fonts are
// self-hosted via next/font/google (no external font origin needed).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS_ORIGIN}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Keep ffmpeg-static out of the webpack bundle. When it's bundled, its
  // `__dirname` is rewritten and the exported binary path resolves to a
  // non-existent location (`/ROOT/.../ffmpeg`), causing `spawn ... ENOENT`.
  // As an external package it stays in node_modules and the path resolves
  // correctly at runtime.
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],

  // The binary itself is spawned by path (not imported), so file tracing
  // doesn't include it automatically — force it into the Inngest function bundle.
  outputFileTracingIncludes: {
    "/api/inngest": ["./node_modules/ffmpeg-static/**"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Static gate**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 3: Live browser check (required for this item specifically)**

Start the dev server via `preview_start`, then:
- `preview_console_logs` (level: all) after loading `/login` — check for CSP violation messages.
- `preview_network` — confirm the page's own requests (Supabase auth call) succeed, not blocked.
- Load `/dashboard` (or `/upload` if not authenticated) and repeat the console check.

If any CSP violation appears for a legitimate resource (e.g. a font or Supabase call), adjust the CSP directive it names and re-check — don't proceed with a policy that breaks real functionality.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add next.config.ts
git commit -m "fix(security): add baseline security response headers

CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS.
Verified live in the browser (console + network) — no legitimate
request blocked.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Upload MIME/size hardening

**Files:** Create `supabase/migrations/0014_harden_recordings_bucket.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Salezy: enforce MIME type + size limits at the storage layer, mirroring
-- lib/constants.ts's ALLOWED_MIME_TYPES/MAX_FILE_BYTES exactly — defense in
-- depth alongside the existing client-side check (isAllowedAudio), which a
-- malicious client could bypass entirely. Run this in the Supabase SQL Editor.

update storage.buckets
set
  allowed_mime_types = array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/x-flac',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ],
  file_size_limit = 52428800 -- 50MB, matching lib/constants.ts's MAX_FILE_BYTES
where id = 'recordings';
```

- [ ] **Step 2: Update `docs/OPS.md`'s migration list**

Add `0014_harden_recordings_bucket.sql` to the list in `docs/OPS.md` (append after `0013`), noting it's also pending manual apply.

- [ ] **Step 3: Static gate (migration files aren't type-checked, but confirm nothing else broke)**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add supabase/migrations/0014_harden_recordings_bucket.sql docs/OPS.md
git commit -m "fix(security): enforce MIME type + size limits on the recordings bucket

Closes the client-only validation gap — isAllowedAudio (lib/constants.ts)
only runs in the browser and a malicious client could bypass it entirely.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Missing `loading.tsx`/`error.tsx`

**Files:**
- Create: `app/analysis/[id]/loading.tsx`
- Create: `app/analysis/[id]/error.tsx`
- Create: `app/upload/loading.tsx`
- Create: `app/upload/error.tsx`

- [ ] **Step 1: `app/analysis/[id]/loading.tsx`** — reuses the existing `ResultSkeleton` component so the route-level loading state (shown before any client code mounts) matches the in-view processing skeleton already used elsewhere.

```tsx
import { ResultSkeleton } from "@/components/salezy/result-skeleton";

export default function AnalysisLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
      <div className="mt-2 h-8 w-56 animate-pulse rounded bg-zinc-800" />
      <ResultSkeleton />
    </main>
  );
}
```

- [ ] **Step 2: `app/analysis/[id]/error.tsx`** — same structure as the existing root `app/error.tsx`, scoped copy.

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-xl font-bold text-foreground">לא הצלחנו לטעון את הניתוח</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          נתקלנו בתקלה בלתי צפויה בטעינת השיחה הזו. אפשר לנסות שוב — ואם זה
          חוזר, חזרו לדשבורד.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            נסה שוב
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-700 px-4 py-2.5 font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-foreground"
          >
            חזרה לדשבורד
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: `app/upload/loading.tsx`**

```tsx
export default function UploadLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
      <div className="mt-6 h-56 w-full animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </main>
  );
}
```

- [ ] **Step 4: `app/upload/error.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function UploadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-xl font-bold text-foreground">לא הצלחנו לטעון את מסך ההעלאה</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          נתקלנו בתקלה בלתי צפויה. אפשר לנסות שוב — ואם זה חוזר, חזרו לדשבורד.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            נסה שוב
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-700 px-4 py-2.5 font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-foreground"
          >
            חזרה לדשבורד
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add app/analysis/[id]/loading.tsx app/analysis/[id]/error.tsx app/upload/loading.tsx app/upload/error.tsx
git commit -m "fix(ux): add missing loading/error states for /analysis/[id] and /upload

Both routes previously fell through to the root loading/error
boundary, losing route context. loading.tsx for /analysis/[id]
reuses the existing ResultSkeleton component.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: DISC ensemble pass-count bias

**Files:** Modify `lib/disc.ts` (`ensembleDetectSigns`, `computeCustomerPersonality`)

- [ ] **Step 1: Return the successful pass count from `ensembleDetectSigns`**

Find:

```ts
export async function ensembleDetectSigns(
  transcript: string,
  passes: number = getDiscEnsemblePasses()
): Promise<RawDiscSigns> {
  const settled = await Promise.allSettled(
    Array.from({ length: passes }, () => detectSignsOnce(transcript))
  );
  const ok = settled
    .filter((r): r is PromiseFulfilledResult<RawDiscSigns> => r.status === "fulfilled")
    .map((r) => r.value);
  return ok.length > 0 ? poolSigns(ok) : EMPTY_RAW_SIGNS;
}
```

Replace with:

```ts
export async function ensembleDetectSigns(
  transcript: string,
  passes: number = getDiscEnsemblePasses()
): Promise<{ signs: RawDiscSigns; successfulPasses: number }> {
  const settled = await Promise.allSettled(
    Array.from({ length: passes }, () => detectSignsOnce(transcript))
  );
  const ok = settled
    .filter((r): r is PromiseFulfilledResult<RawDiscSigns> => r.status === "fulfilled")
    .map((r) => r.value);
  return {
    signs: ok.length > 0 ? poolSigns(ok) : EMPTY_RAW_SIGNS,
    successfulPasses: ok.length,
  };
}
```

- [ ] **Step 2: Use the successful count, not the requested one, at the call site**

Find:

```ts
export async function computeCustomerPersonality(
  transcript: string,
  step: DiscStep
): Promise<AnalysisResult["customerPersonality"]> {
  const passes = getDiscEnsemblePasses();
  const raw = await step.run("score-disc", () => ensembleDetectSigns(transcript, passes));
  const computed = computeDiscResult(raw, passes);
```

Replace with:

```ts
export async function computeCustomerPersonality(
  transcript: string,
  step: DiscStep
): Promise<AnalysisResult["customerPersonality"]> {
  const passes = getDiscEnsemblePasses();
  const { signs: raw, successfulPasses } = await step.run("score-disc", () =>
    ensembleDetectSigns(transcript, passes)
  );
  // Density must reflect passes that actually returned data, not the
  // requested count — otherwise a partial-failure run (some passes reject)
  // under-counts density and skews toward indeterminate even when the
  // passes that DID succeed found plenty of signal.
  const computed = computeDiscResult(raw, successfulPasses || 1);
```

(`|| 1` guards the pathological all-failed case — `successfulPasses` is 0 there, and `computeDiscResult` already treats an empty `raw` as indeterminate regardless of the divisor, so this only prevents a divide-by-zero, not a behavior change.)

- [ ] **Step 3: Check for other call sites of `ensembleDetectSigns`**

Run: `cd "C:\Users\PC\Claude\salezy" && grep -rn "ensembleDetectSigns" --include=*.ts --include=*.tsx .`
Expected: only the definition (`lib/disc.ts`) and the one call site just updated (`computeCustomerPersonality`), plus possibly `scripts/disc-selftest.ts` or `scripts/disc-stability.ts` — if either references it, check whether it destructures the old `RawDiscSigns` return shape directly and update it to the new `{ signs, successfulPasses }` shape too.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. If a script under `scripts/` fails to type-check because of the signature change, fix its usage the same way as Step 2.

- [ ] **Step 5: Run the DISC self-test to confirm no regression**

Run: `npx tsx scripts/disc-selftest.ts`
Expected: `ALL PASSED`. (This test exercises `computeDiscResult` directly with hand-built signs, not `ensembleDetectSigns`, so it shouldn't be affected by this change — running it is a cheap regression check on the surrounding DISC logic.)

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add lib/disc.ts
git commit -m "fix(disc): normalize ensemble density by successful passes, not requested

Promise.allSettled already drops failed passes from the pooled signs,
but computeCustomerPersonality still divided density by the requested
pass count — a partial failure understated density and skewed toward
indeterminate even when the passes that succeeded had good signal.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Patterns chart color

**Files:** Modify `components/salezy/patterns-view.tsx:42`

- [ ] **Step 1: Swap the color**

Find:

```tsx
              <Bar dataKey="average" name="ממוצע" fill="#4D7EFF" radius={[4, 4, 0, 0]} />
```

Replace with:

```tsx
              <Bar dataKey="average" name="ממוצע" fill="#00D4A0" radius={[4, 4, 0, 0]} />
```

(Raw hex, not `var(--score-high)` — matches this exact file's existing convention; every other color reference in it, e.g. `stroke="#2A2A3D"`, is already a raw hex literal.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add components/salezy/patterns-view.tsx
git commit -m "fix(design): use --score-high token color for the patterns bar chart

DESIGN.md specifies chart primary series should use --score-high;
this bar was using the accent-blue token instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## After all 7 tasks

Run the full static gate one more time (`npx tsc --noEmit && npm run lint && npm run build`) on the accumulated result, then report a summary and hand off to `finishing-a-development-branch` as usual. Item 8 (doc drift) starts as a fresh brainstorm after this, per user instruction.
