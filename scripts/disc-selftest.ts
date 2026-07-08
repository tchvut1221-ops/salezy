/**
 * Pure-logic self-test for computeDiscResult() (lib/disc.ts) — the deterministic
 * sign-tally → quadrant/confidence/indeterminate mapping. No LLM calls, no
 * secrets required; hand-constructed sign-sets stand in for scoreDiscAxes()'s
 * output. Run before every DISC-engine change to catch regressions in the
 * scoring formula (see plan swirling-squishing-clover.md's "pure-logic check").
 *
 * Usage: npx tsx scripts/disc-selftest.ts
 */
import { computeDiscResult } from "../lib/disc";

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

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
