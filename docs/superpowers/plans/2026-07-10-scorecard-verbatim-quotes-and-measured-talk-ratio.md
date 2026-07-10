# Scorecard Verbatim Quotes + Measured Talk Ratio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit findings P1 (scorecard quotes aren't checked against the transcript) and P2 (talk ratio is an LLM guess framed as a measured metric) by threading the transcript into synthesis and computing both checks deterministically in code.

**Architecture:** Extract two small, dependency-free pure-function modules (`lib/verbatim.ts`, `lib/talk-ratio.ts`) so both the DISC engine and the scorecard share one verbatim-quote check, and talk ratio is counted from the diarized transcript instead of estimated by an LLM. Wire `transcript` through `synthesizeAnalysis` → `normalizeScorecard` so both checks have the data they need.

**Tech Stack:** TypeScript, no test framework in this repo — verification is `npx tsc --noEmit` / `npm run lint` / `npm run build`, plus small standalone `npx tsx` self-test scripts for the two new pure modules (mirroring the existing `scripts/disc-selftest.ts` pattern).

**Spec:** `docs/superpowers/specs/2026-07-10-scorecard-verbatim-quotes-and-measured-talk-ratio-design.md`

**Note on one deviation from the spec:** the spec described `computeRepPercentage` as living inside `lib/analysis.ts`. This plan puts it in its own `lib/talk-ratio.ts` instead, for the same reason `lib/verbatim.ts` is its own file: `lib/analysis.ts` constructs an OpenAI client at module load (`new OpenAI(...)` at the top of the file), so anything that imports from it needs real API secrets even just to run a pure-function self-test (this bit `scripts/disc-selftest.ts` before — see project memory). Keeping both new helpers dependency-free means their self-tests run with zero secrets.

---

### Task 1: Extract shared verbatim-quote matching into `lib/verbatim.ts`

**Files:**
- Create: `lib/verbatim.ts`
- Create: `scripts/verbatim-selftest.ts`
- Modify: `lib/disc.ts:1-14` (imports), `lib/disc.ts:149-175` (remove local copy, use the shared one)

- [ ] **Step 1: Write the self-test first (it will fail — the module doesn't exist yet)**

Create `scripts/verbatim-selftest.ts`:

```ts
/**
 * Pure self-test for lib/verbatim.ts — no secrets needed (unlike
 * disc-selftest.ts, this module has zero external client imports).
 * Run: npx tsx scripts/verbatim-selftest.ts
 */
import { normalizeForMatch, isVerbatimQuote } from "../lib/verbatim";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (!pass) {
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  actual:   ${JSON.stringify(actual)}`);
    failures++;
  }
}

const transcript = normalizeForMatch(
  "דובר 1: שלום, מה שלומך היום?\nדובר 2: הכל טוב, תודה רבה."
);

check("exact quote matches", isVerbatimQuote("מה שלומך היום", transcript), true);
check(
  "quote with different punctuation still matches",
  isVerbatimQuote("מה שלומך היום?", transcript),
  true
);
check(
  "quote not in transcript fails",
  isVerbatimQuote("אני רוצה לקנות עכשיו", transcript),
  false
);
check(
  "single-character quote fails the length floor even though it's technically a substring",
  isVerbatimQuote("מ", transcript),
  false
);
check("empty quote fails", isVerbatimQuote("", transcript), false);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd "C:\Users\PC\Claude\salezy" && npx tsx scripts/verbatim-selftest.ts`
Expected: fails to resolve — `Cannot find module '../lib/verbatim'` (the module doesn't exist yet).

- [ ] **Step 3: Create `lib/verbatim.ts`**

```ts
/** Strips Hebrew niqqud/cantillation and common punctuation for loose substring matching. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'׳״.,!?;:()\-–—]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `quote` can be found (loosely normalized) inside an
 * already-normalized transcript. Callers normalize the transcript once via
 * normalizeForMatch and reuse it across multiple quote checks, rather than
 * re-normalizing the whole transcript per quote.
 */
export function isVerbatimQuote(quote: string, normalizedTranscript: string): boolean {
  const q = normalizeForMatch(quote);
  return q.length >= 2 && normalizedTranscript.includes(q);
}
```

- [ ] **Step 4: Run the self-test again to confirm it passes**

Run: `cd "C:\Users\PC\Claude\salezy" && npx tsx scripts/verbatim-selftest.ts`
Expected: all 5 checks print `✓`, final line `All checks passed.`, exit code 0.

- [ ] **Step 5: Refactor `lib/disc.ts` to use the shared module**

In `lib/disc.ts`, add this import after the existing `import { parseModelJson } from "@/lib/analysis";` (line 5):

```ts
import { normalizeForMatch, isVerbatimQuote } from "@/lib/verbatim";
```

Then replace the local `normalizeForMatch` function and `filterVerbatimSigns`'s inline check (`lib/disc.ts:149-175`) — delete the local `normalizeForMatch` definition entirely, and change `filterVerbatimSigns` from:

```ts
function filterVerbatimSigns(raw: RawDiscSigns, transcript: string): RawDiscSigns {
  const normalizedTranscript = normalizeForMatch(transcript);
  const isVerbatim = (quote: string) => {
    const q = normalizeForMatch(quote);
    return q.length >= 2 && normalizedTranscript.includes(q);
  };
  return {
    formalInformalSigns: raw.formalInformalSigns.filter((s) => isVerbatim(s.quote)),
    dominantPassiveSigns: raw.dominantPassiveSigns.filter((s) => isVerbatim(s.quote)),
  };
}
```

to:

```ts
function filterVerbatimSigns(raw: RawDiscSigns, transcript: string): RawDiscSigns {
  const normalizedTranscript = normalizeForMatch(transcript);
  const isVerbatim = (quote: string) => isVerbatimQuote(quote, normalizedTranscript);
  return {
    formalInformalSigns: raw.formalInformalSigns.filter((s) => isVerbatim(s.quote)),
    dominantPassiveSigns: raw.dominantPassiveSigns.filter((s) => isVerbatim(s.quote)),
  };
}
```

This is a pure relocation — `filterVerbatimSigns`'s behavior is unchanged.

- [ ] **Step 6: Type-check to confirm the refactor is clean**

Run: `cd "C:\Users\PC\Claude\salezy" && npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add lib/verbatim.ts scripts/verbatim-selftest.ts lib/disc.ts
git commit -m "refactor: extract verbatim-quote matching into lib/verbatim.ts

DISC's anti-fabrication check (normalizeForMatch + substring match) is
about to be reused by the scorecard too, so it moves into its own
dependency-free module instead of staying a private copy inside
lib/disc.ts. disc.ts's filterVerbatimSigns behavior is unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Create `lib/talk-ratio.ts`

**Files:**
- Create: `lib/talk-ratio.ts`
- Create: `scripts/talk-ratio-selftest.ts`

- [ ] **Step 1: Write the self-test first (it will fail — the module doesn't exist yet)**

Create `scripts/talk-ratio-selftest.ts`:

```ts
/**
 * Pure self-test for lib/talk-ratio.ts — no secrets needed.
 * Run: npx tsx scripts/talk-ratio-selftest.ts
 */
import { computeRepPercentage } from "../lib/talk-ratio";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (!pass) {
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  actual:   ${JSON.stringify(actual)}`);
    failures++;
  }
}

// Synthetic fixed-length turns so the expected percentage is exact and easy
// to verify by inspection: דובר 1 gets 70 characters total, דובר 2 gets 30.
const transcript = [
  `דובר 1: ${"א".repeat(40)}`,
  `דובר 2: ${"ב".repeat(30)}`,
  `דובר 1: ${"א".repeat(30)}`,
].join("\n");

check(
  "rep percentage = rep's character share (70/100)",
  computeRepPercentage(transcript, "דובר 1"),
  70
);
check(
  "the other speaker's label returns their own share, not the rep's",
  computeRepPercentage(transcript, "דובר 2"),
  30
);
check("label not present in transcript returns null", computeRepPercentage(transcript, "דובר 3"), null);
check("undefined label returns null", computeRepPercentage(transcript, undefined), null);
check(
  "single-speaker transcript returns null (diarization didn't separate parties)",
  computeRepPercentage("דובר 1: שלום שלום שלום", "דובר 1"),
  null
);
check("empty transcript returns null", computeRepPercentage("", "דובר 1"), null);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd "C:\Users\PC\Claude\salezy" && npx tsx scripts/talk-ratio-selftest.ts`
Expected: fails to resolve — `Cannot find module '../lib/talk-ratio'`.

- [ ] **Step 3: Create `lib/talk-ratio.ts`**

```ts
/**
 * Measures the salesperson's share of a diarized transcript by counting
 * characters per speaker label, replacing an earlier LLM percentage guess
 * (see docs/superpowers/specs/2026-07-10-scorecard-verbatim-quotes-and-measured-talk-ratio-design.md).
 * Character count is a proxy for speaking-time share, not literal seconds —
 * formatDiarized (lib/whisper.ts) merges same-speaker segments into text and
 * doesn't preserve per-segment durations.
 */
const SPEAKER_LINE_RE = /^(דובר \d+):\s?(.*)$/;

export function computeRepPercentage(
  transcript: string,
  speakerLabel: string | undefined
): number | null {
  if (!speakerLabel) return null;

  const totals = new Map<string, number>();
  for (const line of transcript.split("\n")) {
    const match = SPEAKER_LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, label, text] = match;
    totals.set(label, (totals.get(label) ?? 0) + text.length);
  }

  // Diarization didn't separate two parties — a ratio wouldn't be meaningful.
  if (totals.size < 2) return null;

  // Exact match on purpose, not fuzzy: if the model's label doesn't match a
  // real transcript label exactly, fail safe to null rather than guess.
  const repChars = totals.get(speakerLabel.trim());
  const totalChars = [...totals.values()].reduce((a, b) => a + b, 0);
  if (repChars == null || totalChars === 0) return null;

  return Math.round((repChars / totalChars) * 1000) / 10;
}
```

- [ ] **Step 4: Run the self-test again to confirm it passes**

Run: `cd "C:\Users\PC\Claude\salezy" && npx tsx scripts/talk-ratio-selftest.ts`
Expected: all 6 checks print `✓`, final line `All checks passed.`, exit code 0.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add lib/talk-ratio.ts scripts/talk-ratio-selftest.ts
git commit -m "feat: add computeRepPercentage for measuring talk ratio from the transcript

Pure, dependency-free function that counts characters per speaker
label. Not wired into the pipeline yet — that's the next task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire both fixes into the analysis pipeline

**Files:**
- Modify: `lib/analysis.ts` (imports, Zod schema, reasoning prompt, synthesis prompt, `synthesizeAnalysis` signature, `normalizeScorecard`)
- Modify: `lib/inngest/functions.ts` (synthesize step call site)

- [ ] **Step 1: Add imports to `lib/analysis.ts`**

After the existing `import { SALES_SYSTEM_KNOWLEDGE } from "@/lib/sales-knowledge";` line, add:

```ts
import { normalizeForMatch, isVerbatimQuote } from "@/lib/verbatim";
import { computeRepPercentage } from "@/lib/talk-ratio";
```

- [ ] **Step 2: Replace the `talkRatioSalesperson` schema field**

Find in the `callMetrics` Zod object:

```ts
      talkRatioSalesperson: z.number().optional().catch(undefined),
```

Replace with:

```ts
      salespersonSpeakerLabel: z.string().optional().catch(undefined),
```

- [ ] **Step 3: Update the reasoning prompt (section 13)**

Find this line in `reasonAboutCall`'s system prompt:

```
13. מדדי שיחה (רק אם ניתן להעריך מהתמלול): משך משוער בדקות, יחס הדיבור של איש המכירות באחוזים (אמוד לפי כמות הדיבור של כל דובר), רמת אנרגיה, קצב, וסנטימנט בתחילת/אמצע/סוף השיחה. אם אי אפשר להעריך מדד מסוים — דלג עליו ואל תנחש.
```

Replace with:

```
13. מדדי שיחה (רק אם ניתן להעריך מהתמלול): משך משוער בדקות, זיהוי איזו תווית דובר (למשל 'דובר 1') היא איש המכירות — על סמך מי מוביל את השיחה, שואל שאלות גילוי, מציג פתרון ומטפל בהתנגדויות (ציין זאת בבירור בטקסט, למשל 'איש המכירות הוא דובר 1'; אם לא ניתן לזהות בבירור — ציין זאת ואל תנחש), רמת אנרגיה, קצב, וסנטימנט בתחילת/אמצע/סוף השיחה. אם אי אפשר להעריך מדד מסוים — דלג עליו ואל תנחש.
```

- [ ] **Step 4: Update the synthesis JSON template**

Find this line in `synthesizeAnalysis`'s system prompt template:

```
    "talkRatioSalesperson": 0-100,
```

Replace with:

```
    "salespersonSpeakerLabel": "דובר 1",
```

- [ ] **Step 5: Add a "don't guess the label" instruction**

Find this line in the same prompt's "⚠️ חשוב" bullet list:

```
- אל תכלול overallScorecardScore ואל תכלול talkRatio בתוך salespersonScorecard — הם מחושבים אוטומטית מחוץ ל-JSON שלך, אל תמציא אותם.
```

Add this new bullet immediately after it:

```
- callMetrics.salespersonSpeakerLabel חייב להיות בדיוק כפי שמופיע בתמלול (למשל "דובר 1" או "דובר 2") ורק אם זוהה בבירור בניתוח; אם לא זוהה, השמט את השדה לגמרי ואל תנחש.
```

- [ ] **Step 6: Add `transcript` to `synthesizeAnalysis`'s signature**

Find:

```ts
export async function synthesizeAnalysis(
  reasoning: string
): Promise<AnalysisResult> {
```

Replace with:

```ts
export async function synthesizeAnalysis(
  reasoning: string,
  transcript: string
): Promise<AnalysisResult> {
```

- [ ] **Step 7: Pass `transcript` to `normalizeScorecard`'s call site**

Find:

```ts
  if (raw?.salespersonScorecard) {
    raw.salespersonScorecard = normalizeScorecard(raw.salespersonScorecard, raw.callMetrics);
  }
```

Replace with:

```ts
  if (raw?.salespersonScorecard) {
    raw.salespersonScorecard = normalizeScorecard(raw.salespersonScorecard, raw.callMetrics, transcript);
  }
```

- [ ] **Step 8: Rewrite `normalizeScorecard`**

Find (the last line of the existing doc comment through the end of the function, `lib/analysis.ts:~540-588` — the doc comment's earlier lines describing points 1-2 stay as a unique enough anchor above this):

```ts
 *  3. overallScorecardScore is recomputed as the average of the non-null
 *     category scores — never trusted from the model — eliminating
 *     arithmetic drift on the feature's headline number.
 */
function normalizeScorecard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw model JSON, shape-checked here then Zod-validated by resultSchema
  raw: any,
  callMetrics: { talkRatioSalesperson?: number } | undefined
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const categories = ["opening", "discovery", "pitch", "objectionHandling", "closing"] as const;

  for (const key of categories) {
    const cat = raw[key];
    if (!cat) continue;
    const hasRealQuote = typeof cat.quote === "string" && cat.quote.trim().length > 0;
    if (!hasRealQuote) cat.score = null;
  }

  const scores = categories
    .map((key) => raw[key]?.score)
    .filter((s): s is number => typeof s === "number");
  raw.overallScorecardScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;

  const repPct = callMetrics?.talkRatioSalesperson;
  const BENCHMARK = 43;
  const TOLERANCE = 5; // +/-5pp around the benchmark still counts as "optimal"
  if (typeof repPct === "number") {
    const verdict =
      repPct > BENCHMARK + TOLERANCE
        ? "above_optimal"
        : repPct < BENCHMARK - TOLERANCE
          ? "below_optimal"
          : "optimal";
    raw.talkRatio = {
      repPercentage: repPct,
      customerPercentage: Math.round((100 - repPct) * 10) / 10,
      benchmarkRepPercentage: BENCHMARK,
      verdict,
    };
  } else {
    raw.talkRatio = null;
  }

  return raw;
}
```

Replace with:

```ts
/**
 * Post-processes the model's raw scorecard JSON with anti-fabrication /
 * anti-drift guarantees, mirroring the DISC engine's pattern (lib/disc.ts):
 *  1. A category's score AND quote are both nulled unless the quote can
 *     actually be found (loosely normalized) in the transcript — never
 *     trust the model's claim that a quote is verbatim.
 *  2. overallScorecardScore is recomputed as the average of the non-null
 *     category scores — never trusted from the model — eliminating
 *     arithmetic drift on the feature's headline number.
 *  3. talkRatio.repPercentage is computed by counting transcript characters
 *     per speaker label (lib/talk-ratio.ts), using only the model's
 *     identification of *which* label is the salesperson — never an LLM
 *     percentage guess.
 */
function normalizeScorecard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw model JSON, shape-checked here then Zod-validated by resultSchema
  raw: any,
  callMetrics: { salespersonSpeakerLabel?: string } | undefined,
  transcript: string
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const categories = ["opening", "discovery", "pitch", "objectionHandling", "closing"] as const;

  const normalizedTranscript = normalizeForMatch(transcript);
  for (const key of categories) {
    const cat = raw[key];
    if (!cat) continue;
    const hasRealQuote =
      typeof cat.quote === "string" && isVerbatimQuote(cat.quote, normalizedTranscript);
    if (!hasRealQuote) {
      cat.score = null;
      cat.quote = null;
    }
  }

  const scores = categories
    .map((key) => raw[key]?.score)
    .filter((s): s is number => typeof s === "number");
  raw.overallScorecardScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;

  const repPct = computeRepPercentage(transcript, callMetrics?.salespersonSpeakerLabel);
  const BENCHMARK = 43;
  const TOLERANCE = 5; // +/-5pp around the benchmark still counts as "optimal"
  if (typeof repPct === "number") {
    const verdict =
      repPct > BENCHMARK + TOLERANCE
        ? "above_optimal"
        : repPct < BENCHMARK - TOLERANCE
          ? "below_optimal"
          : "optimal";
    raw.talkRatio = {
      repPercentage: repPct,
      customerPercentage: Math.round((100 - repPct) * 10) / 10,
      benchmarkRepPercentage: BENCHMARK,
      verdict,
    };
  } else {
    raw.talkRatio = null;
  }

  return raw;
}
```

- [ ] **Step 9: Update the `synthesizeAnalysis` call site in `lib/inngest/functions.ts`**

Find:

```ts
    const result = await step.run("synthesize", async () => {
      return synthesizeAnalysis(reasoning);
    });
```

Replace with:

```ts
    const result = await step.run("synthesize", async () => {
      return synthesizeAnalysis(reasoning, transcript);
    });
```

- [ ] **Step 10: Re-run both self-tests (regression check — neither module changed, but confirms nothing upstream broke their exports)**

Run: `cd "C:\Users\PC\Claude\salezy" && npx tsx scripts/verbatim-selftest.ts && npx tsx scripts/talk-ratio-selftest.ts`
Expected: both print `All checks passed.`, exit code 0.

- [ ] **Step 11: Full static gate**

Run: `cd "C:\Users\PC\Claude\salezy" && npx tsc --noEmit`
Expected: exits 0, no errors.

Run: `cd "C:\Users\PC\Claude\salezy" && npm run lint`
Expected: exits 0, no new errors (pre-existing 2 warnings in `scripts/vercel-deploy.mjs` are unrelated and fine).

Run: `cd "C:\Users\PC\Claude\salezy" && npm run build`
Expected: `✓ Compiled successfully`, build completes, exits 0.

- [ ] **Step 12: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add lib/analysis.ts lib/inngest/functions.ts
git commit -m "fix(analysis): verify scorecard quotes verbatim, measure talk ratio from transcript

Closes audit findings P1 and P2. synthesizeAnalysis now receives the
transcript: normalizeScorecard nulls both score and quote for any
scorecard category whose quote isn't actually in the transcript
(mirroring DISC's existing filterVerbatimSigns), and talkRatio's
repPercentage is computed by counting transcript characters per
speaker label instead of trusting an LLM percentage estimate. The
reasoning prompt now asks Claude to identify which דובר N is the
salesperson (a narrow, low-risk identification) instead of asking it
to eyeball a percentage.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Still not covered by this plan (unchanged from the spec)

No automated test suite exists in this repo, so there's no live-pipeline verification here — that requires real Supabase/OpenAI/Anthropic secrets and a real Hebrew call, same caveat as prior work in this repo when live secrets weren't available in-session. If secrets are available when this plan is executed, an optional Task 4 (live pipeline run + click-through on `/analysis/[id]`) is worth doing before merge, but is not required to consider this plan complete — the three static gates (tsc/lint/build) plus the two self-tests are the bar, matching the spec's stated verification plan.

Everything else from the 2026-07-09 audit (ivrit/Runpod branch decision, upload MIME/size hardening, `retryAnalysis` status guard, error sanitization, security headers, doc drift, branch/`.worktrees` cleanup) is unrelated, separate work.
