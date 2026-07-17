/**
 * Pure self-test for lib/a11y-contrast.ts — no secrets needed.
 * Asserts every design-system text/background pair meets WCAG AA, and
 * exercises the calculator against known reference ratios.
 * Run: npx tsx scripts/a11y-contrast-selftest.ts
 */
import { getContrastRatio, meetsWCAGAA, DESIGN_SYSTEM_PAIRS } from "../lib/a11y-contrast";

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

// Reference values: black-on-white is the maximum possible ratio (21:1);
// same-color-on-itself is the minimum (1:1).
check("black on white = 21:1", Math.round(getContrastRatio("#000000", "#ffffff") * 100) / 100, 21);
check("white on black = 21:1", Math.round(getContrastRatio("#ffffff", "#000000") * 100) / 100, 21);
check("same color = 1:1", getContrastRatio("#4d7eff", "#4d7eff"), 1);
check("meetsWCAGAA true for high contrast", meetsWCAGAA("#f0f0ff", "#0a0a0f"), true);
check("meetsWCAGAA false for low contrast", meetsWCAGAA("#1a1a26", "#0a0a0f"), false);
check(
  "meetsWCAGAA large-text threshold (3:1) is looser than normal (4.5:1)",
  meetsWCAGAA("#4d7eff", "#1a1a26", true) && meetsWCAGAA("#4d7eff", "#1a1a26", true),
  true
);

console.log("\nDesign-system pairs:");
for (const pair of DESIGN_SYSTEM_PAIRS) {
  const ratio = getContrastRatio(pair.foreground, pair.background);
  const pass = meetsWCAGAA(pair.foreground, pair.background, pair.isLargeText);
  console.log(`  ${pass ? "✓" : "✗"} ${pair.name}: ${ratio.toFixed(2)}:1`);
  if (!pass) {
    failures++;
    console.error(`    FAILS WCAG AA (needs ${pair.isLargeText ? "3:1" : "4.5:1"})`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
