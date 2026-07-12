import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AUDIO_RETENTION_DAYS,
  OTP_CODES_RETENTION_HOURS,
  OTP_RATE_LIMIT_RETENTION_DAYS,
  isAudioPurgeEligible,
  retentionCutoffIso,
} from "@/lib/retention-policy";

/**
 * Upper bound on rows handled per nightly run. Storage removals are one
 * round-trip each (so the whole sweep stays well inside the serverless
 * budget); anything beyond the cap is simply picked up the next night.
 */
const SWEEP_BATCH_SIZE = 200;

/**
 * Nightly retention sweep enforcing lib/retention-policy.ts:
 *
 * 1. Deletes raw recordings from Storage once old enough (30 days after
 *    upload for finished analyses, 60 for rows stuck mid-pipeline) and
 *    stamps `audio_deleted_at`. Transcripts/results are NEVER touched —
 *    deleting those stays a user-only action (app/actions.ts).
 * 2. Purges expired OTP codes and old rate-limit rows, which otherwise
 *    accumulate forever (they're service-role-only tables, invisible to
 *    users, so nothing else ever deletes them).
 *
 * Runs as an Inngest cron (the pipeline already lives on Inngest; pg_cron
 * availability on the current Supabase plan is unverified). 03:00 Israel
 * time keeps the sweep off peak hours. Requires migration 0010.
 */
export const retentionSweep = inngest.createFunction(
  {
    id: "retention-sweep",
    retries: 1,
    triggers: [{ cron: "TZ=Asia/Jerusalem 0 3 * * *" }],
  },
  async ({ step }) => {
    const admin = createAdminClient();

    const audio = await step.run("purge-expired-audio", async () => {
      // Coarse SQL pre-filter at the SHORTEST threshold; the shared
      // predicate makes the precise call per row (stuck rows need 60d).
      const { data, error } = await admin
        .from("analyses")
        .select("id, user_id, file_path, status, created_at, audio_deleted_at")
        .is("audio_deleted_at", null)
        .lt("created_at", retentionCutoffIso(AUDIO_RETENTION_DAYS, new Date()))
        .order("created_at", { ascending: true })
        .limit(SWEEP_BATCH_SIZE);
      if (error) throw error;

      const now = new Date();
      let deleted = 0;
      let skipped = 0;
      for (const row of data ?? []) {
        if (!isAudioPurgeEligible(row, now)) {
          skipped++;
          continue;
        }
        // Same service-role invariant as the pipeline (lib/inngest/
        // functions.ts): never touch a path outside the owner's folder,
        // even to delete it.
        if (!row.file_path.startsWith(`${row.user_id}/`)) {
          console.error(
            `[retention] analysis ${row.id}: file_path outside owner folder — skipped`
          );
          skipped++;
          continue;
        }
        const { error: removeError } = await admin.storage
          .from("recordings")
          .remove([row.file_path]);
        if (removeError) {
          // Leave audio_deleted_at NULL so tomorrow's sweep retries this row.
          console.error(
            `[retention] analysis ${row.id}: storage remove failed: ${removeError.message}`
          );
          skipped++;
          continue;
        }
        // Unconditional update (not updateIfNotTerminal — that guard is for
        // status transitions; this is a fact about the storage object).
        const { error: stampError } = await admin
          .from("analyses")
          .update({ audio_deleted_at: now.toISOString() })
          .eq("id", row.id);
        if (stampError) throw stampError;
        deleted++;
      }
      return { candidates: (data ?? []).length, deleted, skipped };
    });

    const auth = await step.run("purge-auth-rows", async () => {
      const now = new Date();
      const { error: codesError, count: otpCodes } = await admin
        .from("otp_codes")
        .delete({ count: "exact" })
        .lt(
          "created_at",
          new Date(now.getTime() - OTP_CODES_RETENTION_HOURS * 3_600_000).toISOString()
        );
      if (codesError) throw codesError;

      const { error: limitsError, count: rateLimits } = await admin
        .from("otp_rate_limits")
        .delete({ count: "exact" })
        .lt("created_at", retentionCutoffIso(OTP_RATE_LIMIT_RETENTION_DAYS, now));
      if (limitsError) throw limitsError;

      return { otpCodes: otpCodes ?? 0, rateLimits: rateLimits ?? 0 };
    });

    return { ...audio, ...auth };
  }
);
