/**
 * Standalone, network-free regression check for the Runpod polling ceiling
 * formula and multi-job aggregation logic (lib/transcription/providers.ts's
 * computeRunpodPollCeilingMs, lib/transcription/ivrit-provider.ts's
 * aggregatePollResults). Reimplements the pure logic locally — same
 * convention as scripts/verify-audio-guard.mjs — so a formula/aggregation
 * regression is caught before it reaches a real (slow, costly) Runpod run.
 * If the real implementations change, update this script's copies too.
 *
 * Usage: node scripts/verify-runpod-polling.mjs
 */

const DEFAULT_POLL_CEILING_MS = 50 * 60 * 1000;

function computeRunpodPollCeilingMs(durationSeconds, overrideMs) {
  if (Number.isFinite(overrideMs) && overrideMs > 0) return overrideMs;
  if (!durationSeconds) return DEFAULT_POLL_CEILING_MS;
  const proportional = durationSeconds * 0.6 * 1000 + 120_000;
  return Math.max(DEFAULT_POLL_CEILING_MS, proportional);
}

function aggregatePollResults(states) {
  const failed = states.find((s) => s.state === "terminal_failure");
  if (failed) {
    return { done: true, ok: false, failedJobId: failed.jobId, errorMessage: failed.errorMessage };
  }
  const allCompleted = states.every((s) => s.state === "completed");
  if (!allCompleted) return { done: false, ok: false };
  const text = [...states]
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((s) => s.text ?? "")
    .join("\n")
    .trim();
  return { done: true, ok: true, text };
}

let failures = 0;
function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
  if (!pass) {
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
    failures++;
  }
}

// --- ceiling formula ---
assertEqual(
  computeRunpodPollCeilingMs(300, undefined),
  DEFAULT_POLL_CEILING_MS,
  "5-minute call uses the 50-minute default floor"
);
assertEqual(
  computeRunpodPollCeilingMs(3600, undefined),
  DEFAULT_POLL_CEILING_MS,
  "60-minute call (this fix's target) still uses the 50-minute default floor"
);
assertEqual(
  computeRunpodPollCeilingMs(6000, undefined),
  6000 * 0.6 * 1000 + 120_000,
  "100-minute call exceeds the default floor and uses the proportional formula"
);
assertEqual(
  computeRunpodPollCeilingMs(3600, 15_000),
  15_000,
  "IVRIT_TIMEOUT_MS override wins regardless of duration"
);
assertEqual(
  computeRunpodPollCeilingMs(null, undefined),
  DEFAULT_POLL_CEILING_MS,
  "unknown duration falls back to the 50-minute default"
);

// --- aggregation ---
assertEqual(
  aggregatePollResults([
    { chunkIndex: 0, jobId: "a", state: "pending" },
    { chunkIndex: 1, jobId: "b", state: "completed", text: "hi" },
  ]),
  { done: false, ok: false },
  "one chunk still pending -> not done"
);
assertEqual(
  aggregatePollResults([
    { chunkIndex: 1, jobId: "b", state: "completed", text: "שלום" },
    { chunkIndex: 0, jobId: "a", state: "completed", text: "היי" },
  ]),
  { done: true, ok: true, text: "היי\nשלום" },
  "all completed -> done+ok, text joined in chunk order regardless of poll-return order"
);
assertEqual(
  aggregatePollResults([
    { chunkIndex: 0, jobId: "a", state: "completed", text: "היי" },
    { chunkIndex: 1, jobId: "b", state: "terminal_failure", errorMessage: "ivrit job FAILED: boom" },
  ]),
  { done: true, ok: false, failedJobId: "b", errorMessage: "ivrit job FAILED: boom" },
  "one terminal failure among others -> done+not ok, whole call falls back (no provider mixing)"
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll Runpod polling checks passed.");
