# Scorecard verbatim quotes + measured talk ratio — design

## Context

The 2026-07-09 full-system audit (`C:\Users\PC\.claude\plans\full-system-audit-salezy-jiggly-fox.md`, findings P1 and P2) found two gaps in the salesperson scorecard, both High severity:

- **P1:** scorecard category quotes are schema-nullable but never checked against the transcript. `normalizeScorecard` only nulls a category's score when its quote string is non-empty — a fabricated-but-non-empty quote can still reach the UI. DISC already solves this correctly (`lib/disc.ts` `filterVerbatimSigns`); the scorecard never adopted the same check, and structurally can't yet, because `synthesizeAnalysis` never receives the transcript.
- **P2:** `salespersonScorecard.talkRatio.repPercentage` is framed in the UI as a measured metric (`components/salezy/scorecard.tsx`, "מחקר Gong Labs") but its input, `callMetrics.talkRatioSalesperson`, is an LLM eyeball estimate (`lib/analysis.ts` reasoning prompt section 13) — never actually counted from the diarized transcript.

Both fixes require the same missing plumbing (transcript reaching the synthesis/normalization layer), so they're designed and implemented together.

## Architecture change: thread the transcript into synthesis

Today: `functions.ts` calls `synthesizeAnalysis(reasoning)` — the transcript is in scope in `functions.ts` (the `transcribe` step's output) but is never passed further. This changes to:

```
functions.ts:  synthesizeAnalysis(reasoning, transcript)
analysis.ts:   synthesizeAnalysis(reasoning: string, transcript: string)
                 → normalizeScorecard(raw.salespersonScorecard, raw.callMetrics, transcript)
```

No other callers of `synthesizeAnalysis` exist (confirmed by grep), so this is a non-breaking signature change.

## P1 — Verbatim quote enforcement

**Shared helper extraction.** `lib/disc.ts` already has the exact right logic (`normalizeForMatch` + a normalized-substring check, `lib/disc.ts:149-174`). Extract the reusable parts into a new `lib/verbatim.ts` so `disc.ts` and `analysis.ts` share one implementation instead of two copies:

```ts
// lib/verbatim.ts
export function normalizeForMatch(s: string): string { /* moved verbatim from disc.ts */ }
export function isVerbatimQuote(quote: string, normalizedTranscript: string): boolean {
  const q = normalizeForMatch(quote);
  return q.length >= 2 && normalizedTranscript.includes(q);
}
```

`disc.ts`'s `filterVerbatimSigns` imports `normalizeForMatch`/`isVerbatimQuote` from the new module instead of defining its own; its behavior is unchanged (this is a pure relocation, not a logic change).

**`normalizeScorecard` change** (`lib/analysis.ts:544-588`). Add a `transcript: string` parameter. Normalize the transcript once (matching DISC's efficiency pattern — not re-normalizing per category), then for each of the 5 categories:

```ts
const normalizedTranscript = normalizeForMatch(transcript);
for (const key of categories) {
  const cat = raw[key];
  if (!cat) continue;
  const hasRealQuote = typeof cat.quote === "string" && isVerbatimQuote(cat.quote, normalizedTranscript);
  if (!hasRealQuote) {
    cat.score = null;
    cat.quote = null; // currently only score is nulled — a fabricated quote could still render
  }
}
```

This catches fabrication introduced at either pipeline stage (Claude inventing a quote during reasoning, or GPT-4o mis-transcribing it during JSON synthesis) since it validates the final quote string against the original transcript directly, regardless of which stage introduced the drift.

## P2 — Measured talk ratio

**Problem:** diarization labels (`דובר 1`, `דובר 2`, ...) carry no role information — the transcript alone doesn't say which speaker is the rep. A percentage can only be computed in code once we know which label to sum.

**Design:** Claude's reasoning step already reads the full transcript, so it names the rep's speaker label as a small, low-ambiguity identification (much safer than asking it to eyeball a percentage). Code then deterministically sums characters per label and computes the split.

**Prompt change** (`lib/analysis.ts`, reasoning system prompt section 13, ~line 244). Replace the talk-ratio-percentage sub-instruction with a speaker-identification sub-instruction:

> ...זיהוי איזו תווית דובר (למשל 'דובר 1') היא איש המכירות — על סמך מי מוביל את השיחה, שואל שאלות גילוי, מציג פתרון ומטפל בהתנגדויות (ציין זאת בבירור בטקסט, למשל 'איש המכירות הוא דובר 1'; אם לא ניתן לזהות בבירור — ציין זאת ואל תנחש)...

**Synthesis schema change** (`lib/analysis.ts` ~line 147 and the JSON template ~line 365). Replace `callMetrics.talkRatioSalesperson: z.number()` with `callMetrics.salespersonSpeakerLabel: z.string().optional().catch(undefined)`, and the JSON template's `"talkRatioSalesperson": 0-100,` with `"salespersonSpeakerLabel": "דובר 1",`. Add one line to the existing "⚠️ חשוב" bullet list: only include the field if explicitly identified in the reasoning text, never guessed — matching the phrasing already used for other "don't guess" fields in that same prompt.

**Deterministic computation** (new function in `lib/analysis.ts`, next to `normalizeScorecard`):

```ts
const SPEAKER_LINE_RE = /^(דובר \d+):\s?(.*)$/;

function computeRepPercentage(transcript: string, speakerLabel: string | undefined): number | null {
  if (!speakerLabel) return null;
  const totals = new Map<string, number>();
  for (const line of transcript.split("\n")) {
    const match = SPEAKER_LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, label, text] = match;
    totals.set(label, (totals.get(label) ?? 0) + text.length);
  }
  if (totals.size < 2) return null; // diarization didn't separate two parties — a ratio isn't meaningful
  const repChars = totals.get(speakerLabel.trim());
  const totalChars = [...totals.values()].reduce((a, b) => a + b, 0);
  if (repChars == null || totalChars === 0) return null;
  return Math.round((repChars / totalChars) * 1000) / 10;
}
```

`normalizeScorecard` replaces its current `callMetrics?.talkRatioSalesperson` read with `computeRepPercentage(transcript, callMetrics?.salespersonSpeakerLabel)`, then reuses the **existing, unchanged** benchmark/tolerance/verdict logic (`BENCHMARK = 43`, `TOLERANCE = 5`) against that number. When the label is missing, mismatched, or diarization only produced one speaker, `talkRatio` becomes `null` — the existing UI fallback (`scorecard.tsx`) already renders gracefully for a null `talkRatio`, so no UI change is needed.

**Intentional: exact-match, not fuzzy.** `totals.get(speakerLabel.trim())` is an exact Map-key lookup — if GPT-4o returns the label with different wording (e.g. "דובר 1 (המוכר)" instead of "דובר 1"), the lookup misses and `talkRatio` falls back to `null`. This is a deliberate fail-safe, not an oversight: a missed match produces "no ratio shown" (safe), never a silently-wrong ratio from a loose/fuzzy match.

**Known approximation, stated explicitly:** character count is a proxy for speaking-time share, not literal seconds — `formatDiarized` (`lib/whisper.ts`) merges consecutive same-speaker segments into text and doesn't preserve per-segment durations. This is the same class of approximation used elsewhere when true duration isn't available; worth a one-line code comment, not a blocker.

## Files touched

- `lib/verbatim.ts` — new, shared verbatim-quote helpers
- `lib/disc.ts` — `filterVerbatimSigns` imports from `lib/verbatim.ts` instead of its own copy
- `lib/analysis.ts` — reasoning prompt (section 13), synthesis JSON template + schema (`callMetrics`), `synthesizeAnalysis` signature (+`transcript` param), `normalizeScorecard` signature (+`transcript` param, verbatim check, `computeRepPercentage`)
- `lib/inngest/functions.ts` — pass `transcript` to `synthesizeAnalysis`

## Out of scope

Everything else from the audit (ivrit/Runpod branch decision, upload MIME/size hardening, `retryAnalysis` status guard, error sanitization, security headers, doc drift, branch/`.worktrees` cleanup) — unrelated, separate work per the audit's prioritized list.

## Verification plan

No automated test suite exists in this repo (`package.json` has no test runner; `disc-selftest.ts`/`disc-stability.ts` are manual harnesses run via `npx tsx`). Verification bar:

1. Static gate: `npx tsc --noEmit`, `npm run lint`, `npm run build` — must all pass clean.
2. Manual trace through `computeRepPercentage` against 3-4 constructed transcript strings (matching label, mismatched label, single-speaker, empty) confirming the expected `number | null` output for each.
3. Manual trace through the verbatim check against a constructed scorecard category with a genuine quote (passes), a subtly-altered quote (fails → nulled), and a quote containing niqqud/punctuation differences from the transcript (still passes, via `normalizeForMatch`).
4. If real secrets are available in the session's `.env.local`, one live pipeline run against a real Hebrew call to confirm `salespersonSpeakerLabel` gets identified and a non-null `talkRatio` renders — otherwise, note this as still-pending live verification (same caveat as prior work in this repo when live secrets weren't available).
