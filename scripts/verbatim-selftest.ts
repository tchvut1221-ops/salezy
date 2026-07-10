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
