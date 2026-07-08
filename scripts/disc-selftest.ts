/**
 * Pure-logic self-test for computeDiscResult() (lib/disc.ts) — the deterministic
 * sign-tally → quadrant/confidence/indeterminate mapping. No LLM calls, no
 * secrets required; hand-constructed sign-sets stand in for scoreDiscAxes()'s
 * output. Run before every DISC-engine change to catch regressions in the
 * scoring formula (see plan swirling-squishing-clover.md's "pure-logic check").
 *
 * Usage: npx tsx scripts/disc-selftest.ts
 */
import { computeDiscResult, poolSigns, getDiscEnsemblePasses } from "../lib/disc";

type Sign<Pole extends string> = { quote: string; pairNumber: number; pole: Pole };

function formalSign(pole: "formal" | "informal", n: number, q?: string): Sign<"formal" | "informal"> {
  return { quote: q ?? `formal-sign-${n}`, pairNumber: n, pole };
}
function domSign(pole: "dominant" | "passive", n: number, q?: string): Sign<"dominant" | "passive"> {
  return { quote: q ?? `dom-sign-${n}`, pairNumber: n, pole };
}

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("1) Clear Driver (formal + dominant, no contradicting signs)");
{
  const r = computeDiscResult({
    formalInformalSigns: [1, 2, 3, 4, 5].map((n) => formalSign("formal", n)),
    dominantPassiveSigns: [1, 2, 3, 4, 5].map((n) => domSign("dominant", n)),
  });
  check("type is Driver", r.type === "Driver", r.type);
  check("not indeterminate", !r.indeterminate);
  check("no secondaryType (clear signal)", !r.secondaryType, r.secondaryType);
  check("formalInformal score is 18 (max formal)", r.discAxes.formalInformal.score === 18, String(r.discAxes.formalInformal.score));
  check("dominantPassive score is 18 (max dominant)", r.discAxes.dominantPassive.score === 18, String(r.discAxes.dominantPassive.score));
  check("confidence >= 65 (target band)", r.confidence >= 65, String(r.confidence));
}

console.log("2) Clear Amiable (informal + passive)");
{
  const r = computeDiscResult({
    formalInformalSigns: [1, 2, 3, 4, 5].map((n) => formalSign("informal", n)),
    dominantPassiveSigns: [1, 2, 3, 4, 5].map((n) => domSign("passive", n)),
  });
  check("type is Amiable", r.type === "Amiable", r.type);
  check("not indeterminate", !r.indeterminate);
  check("confidence >= 65 (target band)", r.confidence >= 65, String(r.confidence));
}

console.log("3) Clear Expressive (informal + dominant)");
{
  const r = computeDiscResult({
    formalInformalSigns: [1, 2, 3, 4, 5].map((n) => formalSign("informal", n)),
    dominantPassiveSigns: [1, 2, 3, 4, 5].map((n) => domSign("dominant", n)),
  });
  check("type is Expressive", r.type === "Expressive", r.type);
  check("not indeterminate", !r.indeterminate);
}

console.log("4) Clear Analytical (formal + passive)");
{
  const r = computeDiscResult({
    formalInformalSigns: [1, 2, 3, 4, 5].map((n) => formalSign("formal", n)),
    dominantPassiveSigns: [1, 2, 3, 4, 5].map((n) => domSign("passive", n)),
  });
  check("type is Analytical", r.type === "Analytical", r.type);
  check("not indeterminate", !r.indeterminate);
}

console.log("5) Boundary/blend: clear on assertiveness, contested (near-tie) on responsiveness");
{
  const r = computeDiscResult({
    // 4 formal vs 3 informal — real evidence on both sides, close split (contested)
    formalInformalSigns: [
      ...[1, 2, 3, 4].map((n) => formalSign("formal", n)),
      ...[5, 6, 7].map((n) => formalSign("informal", n)),
    ],
    // clearly dominant, no contradicting signs
    dominantPassiveSigns: [1, 2, 3, 4, 5, 6].map((n) => domSign("dominant", n)),
  });
  check("primary type is Driver (formal+dominant wins narrowly)", r.type === "Driver", r.type);
  check("secondaryType is set (contested axis)", !!r.secondaryType, String(r.secondaryType));
  check("secondaryType is the adjacent quadrant (Expressive)", r.secondaryType === "Expressive", r.secondaryType);
}

console.log("6) Thin/empty signals → indeterminate");
{
  const r = computeDiscResult({ formalInformalSigns: [], dominantPassiveSigns: [] });
  check("indeterminate is true", r.indeterminate === true);
  check("still returns a best-guess type (schema requires one)", !!r.type, r.type);
}

console.log("6b) Below MIN_TOTAL_SIGNALS but not zero → still indeterminate");
{
  const r = computeDiscResult({
    formalInformalSigns: [formalSign("formal", 1)],
    dominantPassiveSigns: [],
  });
  check("indeterminate is true (only 1 total signal)", r.indeterminate === true, `confidence=${r.confidence}`);
}

console.log("7) Realistic mixed-but-classifiable call (some disagreement, not unanimous) → confidence lands in the 65-85% target band");
{
  const r = computeDiscResult({
    // 4 formal vs 2 informal — majority formal but not unanimous
    formalInformalSigns: [
      ...[1, 2, 3, 4].map((n) => formalSign("formal", n)),
      ...[5, 6].map((n) => formalSign("informal", n)),
    ],
    // 3 dominant vs 1 passive — majority dominant but not unanimous
    dominantPassiveSigns: [
      ...[1, 2, 3].map((n) => domSign("dominant", n)),
      ...[4].map((n) => domSign("passive", n)),
    ],
  });
  check("not indeterminate", !r.indeterminate);
  check("type is Driver (majority still wins)", r.type === "Driver", r.type);
  check("confidence in [65, 85]", r.confidence >= 65 && r.confidence <= 85, String(r.confidence));
}

console.log("7b) Unanimous signals (no contradiction) → confidence correctly rewarded near the top of the scale");
{
  const r = computeDiscResult({
    formalInformalSigns: [1, 2, 3].map((n) => formalSign("formal", n)),
    dominantPassiveSigns: [1, 2, 3].map((n) => domSign("dominant", n)),
  });
  check("not indeterminate", !r.indeterminate);
  check("confidence > 85 (perfect convergence deserves high confidence)", r.confidence > 85, String(r.confidence));
}

console.log("8) Determinism: same input twice yields identical output (no hidden randomness)");
{
  const raw = {
    formalInformalSigns: [1, 2, 3].map((n) => formalSign("formal", n)),
    dominantPassiveSigns: [1, 2].map((n) => domSign("passive", n)),
  };
  const a = computeDiscResult(raw);
  const b = computeDiscResult(raw);
  check("identical type", a.type === b.type);
  check("identical confidence", a.confidence === b.confidence);
  check("identical indeterminate flag", a.indeterminate === b.indeterminate);
}

console.log("9) poolSigns concatenates verified signs from multiple detection passes");
{
  const pooled = poolSigns([
    { formalInformalSigns: [formalSign("formal", 1)], dominantPassiveSigns: [domSign("dominant", 1)] },
    { formalInformalSigns: [formalSign("informal", 2)], dominantPassiveSigns: [] },
    { formalInformalSigns: [], dominantPassiveSigns: [domSign("passive", 2)] },
  ]);
  check("formalInformal signs pooled (2)", pooled.formalInformalSigns.length === 2, String(pooled.formalInformalSigns.length));
  check("dominantPassive signs pooled (2)", pooled.dominantPassiveSigns.length === 2, String(pooled.dominantPassiveSigns.length));
}

console.log("10) Ensemble stabilizes a noisy call: single passes flip type, but the pooled result is stable (the fix for the Call B run-to-run flip)");
{
  // 5 detection passes on the same borderline call. Responsiveness (formal vs
  // informal) flips run to run — 2 passes read "people", 3 read "task" — exactly
  // the noise that made Call B come out Expressive one run, Driver the next.
  const samples = [
    { formalInformalSigns: [formalSign("informal", 1), formalSign("informal", 2), formalSign("informal", 3), formalSign("formal", 4)], dominantPassiveSigns: [domSign("dominant", 1), domSign("dominant", 2), domSign("dominant", 3), domSign("passive", 4)] },
    { formalInformalSigns: [formalSign("formal", 1), formalSign("formal", 2), formalSign("formal", 3), formalSign("informal", 4)], dominantPassiveSigns: [domSign("dominant", 1), domSign("dominant", 2), domSign("dominant", 3), domSign("dominant", 5)] },
    { formalInformalSigns: [formalSign("informal", 1), formalSign("informal", 2), formalSign("formal", 3)], dominantPassiveSigns: [domSign("dominant", 1), domSign("dominant", 2), domSign("dominant", 3), domSign("passive", 4)] },
    { formalInformalSigns: [formalSign("formal", 1), formalSign("formal", 2), formalSign("formal", 3), formalSign("formal", 4)], dominantPassiveSigns: [domSign("dominant", 1), domSign("dominant", 2), domSign("passive", 4), domSign("passive", 5)] },
    { formalInformalSigns: [formalSign("formal", 1), formalSign("formal", 2), formalSign("informal", 3)], dominantPassiveSigns: [domSign("dominant", 1), domSign("dominant", 2), domSign("dominant", 3)] },
  ];
  const singleTypes = new Set(samples.map((s) => computeDiscResult(s).type));
  check("single passes are genuinely noisy (>1 distinct type)", singleTypes.size > 1, [...singleTypes].join(","));

  const r = computeDiscResult(poolSigns(samples), 5);
  check("pooled type is stable Driver (formal+dominant majority)", r.type === "Driver", r.type);
  check("pooled result is not indeterminate", !r.indeterminate);
  check("pooled surfaces the blend (secondaryType Expressive)", r.secondaryType === "Expressive", String(r.secondaryType));
  check("pooled confidence in the 65-85 target band", r.confidence >= 65 && r.confidence <= 85, String(r.confidence));
}

console.log("11) Sparse ensemble: many passes but ~1 sign each → indeterminate (density normalized by pass count, not raw pooled total)");
{
  // 5 passes × 1 sign = 5 pooled signs. Raw 5 >= MIN_TOTAL_SIGNALS(4) would look
  // classifiable, but averaged over 5 passes that's ~1 sign/pass — genuinely too
  // sparse to classify, so it must stay indeterminate.
  const samples = [1, 2, 3, 4, 5].map((n) => ({
    formalInformalSigns: [formalSign("formal", n)],
    dominantPassiveSigns: [] as ReturnType<typeof domSign>[],
  }));
  const r = computeDiscResult(poolSigns(samples), 5);
  const total = r.discAxes.formalInformal.signalCount + r.discAxes.dominantPassive.signalCount;
  check("indeterminate is true (avg ~1 sign/pass)", r.indeterminate === true, `conf=${r.confidence} pooledTotal=${total}`);
}

console.log("12) getDiscEnsemblePasses: env-tunable, default 5, clamped to [1,9]");
{
  const orig = process.env.DISC_ENSEMBLE_PASSES;
  delete process.env.DISC_ENSEMBLE_PASSES;
  check("default is 5", getDiscEnsemblePasses() === 5, String(getDiscEnsemblePasses()));
  process.env.DISC_ENSEMBLE_PASSES = "3";
  check("reads a valid value (3)", getDiscEnsemblePasses() === 3, String(getDiscEnsemblePasses()));
  process.env.DISC_ENSEMBLE_PASSES = "0";
  check("clamps min to 1", getDiscEnsemblePasses() === 1, String(getDiscEnsemblePasses()));
  process.env.DISC_ENSEMBLE_PASSES = "50";
  check("clamps max to 9", getDiscEnsemblePasses() === 9, String(getDiscEnsemblePasses()));
  process.env.DISC_ENSEMBLE_PASSES = "notanumber";
  check("falls back to 5 on garbage", getDiscEnsemblePasses() === 5, String(getDiscEnsemblePasses()));
  if (orig === undefined) delete process.env.DISC_ENSEMBLE_PASSES;
  else process.env.DISC_ENSEMBLE_PASSES = orig;
}

console.log("13) Backward compatibility: computeDiscResult with default passes=1 matches a single-pass call (existing calibration preserved)");
{
  const raw = {
    formalInformalSigns: [1, 2, 3, 4].map((n) => formalSign("formal", n)),
    dominantPassiveSigns: [1, 2, 3].map((n) => domSign("dominant", n)),
  };
  const implicit = computeDiscResult(raw);
  const explicit = computeDiscResult(raw, 1);
  check("passes defaults to 1", implicit.confidence === explicit.confidence && implicit.type === explicit.type, `${implicit.confidence} vs ${explicit.confidence}`);
}

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
