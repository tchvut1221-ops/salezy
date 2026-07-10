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
