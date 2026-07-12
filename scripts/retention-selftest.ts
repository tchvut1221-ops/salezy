/**
 * Pure self-test for lib/retention-policy.ts — no secrets needed.
 * Run: npx tsx scripts/retention-selftest.ts
 */
import {
  AUDIO_RETENTION_DAYS,
  STUCK_AUDIO_RETENTION_DAYS,
  isAudioPurgeEligible,
  retentionCutoffIso,
} from "../lib/retention-policy";

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

const NOW = new Date("2026-07-12T12:00:00.000Z");
const daysAgo = (d: number) =>
  new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

const row = (over: Partial<Parameters<typeof isAudioPurgeEligible>[0]>) => ({
  created_at: daysAgo(1),
  status: "completed",
  audio_deleted_at: null,
  ...over,
});

// --- terminal rows: 30-day threshold ---
check("fresh completed row (1d) is kept", isAudioPurgeEligible(row({}), NOW), false);
check(
  `completed row at ${AUDIO_RETENTION_DAYS - 1}d is kept`,
  isAudioPurgeEligible(row({ created_at: daysAgo(AUDIO_RETENTION_DAYS - 1) }), NOW),
  false
);
check(
  `completed row at exactly ${AUDIO_RETENTION_DAYS}d is purged`,
  isAudioPurgeEligible(row({ created_at: daysAgo(AUDIO_RETENTION_DAYS) }), NOW),
  true
);
check(
  "failed row past threshold is purged (all terminal statuses count)",
  isAudioPurgeEligible(
    row({ status: "failed", created_at: daysAgo(AUDIO_RETENTION_DAYS + 5) }),
    NOW
  ),
  true
);
check(
  "cancelled row past threshold is purged",
  isAudioPurgeEligible(
    row({ status: "cancelled", created_at: daysAgo(AUDIO_RETENTION_DAYS + 5) }),
    NOW
  ),
  true
);

// --- stuck (non-terminal) rows: 60-day threshold ---
check(
  `stuck transcribing row at ${AUDIO_RETENTION_DAYS + 5}d is kept (debug window)`,
  isAudioPurgeEligible(
    row({ status: "transcribing", created_at: daysAgo(AUDIO_RETENTION_DAYS + 5) }),
    NOW
  ),
  false
);
check(
  `stuck transcribing row at ${STUCK_AUDIO_RETENTION_DAYS}d is purged`,
  isAudioPurgeEligible(
    row({ status: "transcribing", created_at: daysAgo(STUCK_AUDIO_RETENTION_DAYS) }),
    NOW
  ),
  true
);
check(
  "unknown status treated as non-terminal (60d rule)",
  isAudioPurgeEligible(
    row({ status: "some_future_status", created_at: daysAgo(45) }),
    NOW
  ),
  false
);

// --- already swept / bad data: fail closed ---
check(
  "row already stamped audio_deleted_at is never re-purged",
  isAudioPurgeEligible(
    row({ created_at: daysAgo(90), audio_deleted_at: daysAgo(60) }),
    NOW
  ),
  false
);
check(
  "unparsable created_at fails closed (kept)",
  isAudioPurgeEligible(row({ created_at: "not-a-date" }), NOW),
  false
);

// --- cutoff helper sanity ---
check(
  "retentionCutoffIso(30) is exactly 30 days back",
  retentionCutoffIso(30, NOW),
  daysAgo(30)
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll retention policy checks passed.");
