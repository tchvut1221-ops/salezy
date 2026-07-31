import { z } from "zod";

const uuidSchema = z.string().uuid();

/**
 * Every Server Action here already treats "row not found" and "malformed id"
 * identically (a bad UUID makes Postgres/PostgREST return an error, which the
 * existing `if (error || !data ...) throw new Error(notFoundMessage)` checks
 * already collapse into the same generic message) — this just fails before
 * ever reaching the database, instead of relying on that fallback.
 */
export function parseId(id: string, notFoundMessage: string): string {
  const result = uuidSchema.safeParse(id);
  if (!result.success) throw new Error(notFoundMessage);
  return result.data;
}

export const PRACTICE_MESSAGE_MAX_LENGTH = 4000;

/**
 * The practice chat has no client-side length cap (components/salezy/
 * practice-dialog.tsx's Input is unbounded) and `text` is forwarded straight
 * into an Anthropic API call — an unbounded string here is an unbounded-cost
 * request, not just a validation nicety.
 */
export function parsePracticeMessage(text: string): string {
  const result = z.string().trim().min(1).max(PRACTICE_MESSAGE_MAX_LENGTH).safeParse(text);
  if (!result.success) throw new Error("הודעה לא תקינה.");
  return result.data;
}
