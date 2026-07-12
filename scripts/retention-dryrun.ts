/**
 * READ-ONLY dry run of the nightly retention sweep (lib/inngest/retention.ts)
 * against the real database: prints exactly which recordings the next sweep
 * would delete and how many otp_codes / otp_rate_limits rows would be purged.
 * Deletes nothing. Run this before the first live cron run (and any time the
 * policy in lib/retention-policy.ts changes).
 *
 * Usage: npx tsx --env-file=.env.local scripts/retention-dryrun.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  AUDIO_RETENTION_DAYS,
  OTP_CODES_RETENTION_HOURS,
  OTP_RATE_LIMIT_RETENTION_DAYS,
  isAudioPurgeEligible,
  retentionCutoffIso,
} from "../lib/retention-policy";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY — run with --env-file=.env.local"
    );
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date();

  // Mirror of the sweep's candidate query (same coarse filter + precise
  // predicate), without the batch cap so the report is complete.
  const { data, error } = await admin
    .from("analyses")
    .select("id, user_id, file_path, status, created_at, audio_deleted_at")
    .is("audio_deleted_at", null)
    .lt("created_at", retentionCutoffIso(AUDIO_RETENTION_DAYS, now))
    .order("created_at", { ascending: true });
  if (error) throw error;

  const candidates = data ?? [];
  const eligible = candidates.filter((row) => isAudioPurgeEligible(row, now));
  const heldBack = candidates.length - eligible.length;

  console.log(`Audio purge dry run @ ${now.toISOString()}`);
  console.log(
    `  candidates older than ${AUDIO_RETENTION_DAYS}d with audio present: ${candidates.length}`
  );
  console.log(`  would delete now: ${eligible.length} (held back: ${heldBack})`);
  for (const row of eligible) {
    const ageDays = Math.floor(
      (now.getTime() - new Date(row.created_at).getTime()) / 86_400_000
    );
    const pathOk = row.file_path.startsWith(`${row.user_id}/`) ? "" : "  [PATH INVARIANT VIOLATION — sweep will skip]";
    console.log(
      `    ${row.id}  status=${row.status}  age=${ageDays}d  ${row.file_path}${pathOk}`
    );
  }

  const { count: otpCodes } = await admin
    .from("otp_codes")
    .select("id", { count: "exact", head: true })
    .lt(
      "created_at",
      new Date(now.getTime() - OTP_CODES_RETENTION_HOURS * 3_600_000).toISOString()
    );
  const { count: rateLimits } = await admin
    .from("otp_rate_limits")
    .select("id", { count: "exact", head: true })
    .lt("created_at", retentionCutoffIso(OTP_RATE_LIMIT_RETENTION_DAYS, now));

  console.log(`\nAuth-row purge dry run:`);
  console.log(`  otp_codes older than ${OTP_CODES_RETENTION_HOURS}h: ${otpCodes ?? 0}`);
  console.log(
    `  otp_rate_limits older than ${OTP_RATE_LIMIT_RETENTION_DAYS}d: ${rateLimits ?? 0}`
  );
  console.log("\nNothing was deleted (dry run).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
