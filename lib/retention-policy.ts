/**
 * Retention policy — the single source of truth for what Salezy auto-deletes
 * and when. Pure and dependency-free (like lib/verbatim.ts / lib/talk-ratio.ts)
 * so scripts/retention-selftest.ts can exercise it without secrets, and so the
 * numbers quoted to users (upload page) and in the legal docs (docs/legal/*)
 * have exactly one place to stay in sync with.
 *
 * The policy:
 * - The RAW RECORDING is deleted from Storage AUDIO_RETENTION_DAYS after
 *   upload, once its analysis reached a terminal status. Rows stuck in a
 *   non-terminal status (a pipeline that never finished) get the longer
 *   STUCK_AUDIO_RETENTION_DAYS so a debugging window survives.
 * - Transcripts and analysis results are NEVER auto-deleted — they belong to
 *   the user until the user deletes them (app/actions.ts deleteAnalysis).
 * - OTP codes and rate-limit rows are short-lived operational auth data.
 *
 * Enforced by the daily Inngest cron in lib/inngest/retention.ts.
 */

export const AUDIO_RETENTION_DAYS = 30;
export const STUCK_AUDIO_RETENTION_DAYS = 60;
export const OTP_CODES_RETENTION_HOURS = 24;
export const OTP_RATE_LIMIT_RETENTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Statuses the pipeline never writes over once reached (see
 * lib/inngest/functions.ts's updateIfNotTerminal, which imports this).
 * A new status added here counts as "finished" for audio retention too.
 */
export const TERMINAL_STATUSES = [
  "completed",
  "failed",
  "no_speech_detected",
  "cancelled",
] as const;

export interface AudioRetentionRow {
  created_at: string;
  status: string;
  audio_deleted_at: string | null;
}

/**
 * Whether a row's raw recording is due for deletion. The sweep's SQL only
 * pre-filters coarsely (created_at older than the SHORTEST threshold,
 * audio not yet deleted); this predicate is the precise decision, so the
 * policy can't drift between SQL and code.
 */
export function isAudioPurgeEligible(row: AudioRetentionRow, now: Date): boolean {
  if (row.audio_deleted_at) return false;
  const createdAtMs = new Date(row.created_at).getTime();
  // An unparsable timestamp means we can't prove the row is old enough —
  // fail closed (keep the audio) rather than delete on bad data.
  if (Number.isNaN(createdAtMs)) return false;
  const isTerminal = (TERMINAL_STATUSES as readonly string[]).includes(row.status);
  const thresholdDays = isTerminal ? AUDIO_RETENTION_DAYS : STUCK_AUDIO_RETENTION_DAYS;
  return now.getTime() - createdAtMs >= thresholdDays * DAY_MS;
}

/** ISO timestamp `days` days before `now` — for age-based delete filters. */
export function retentionCutoffIso(days: number, now: Date): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}
