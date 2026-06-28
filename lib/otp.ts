import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const CODE_LENGTH = 8;

export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const OTP_MAX_VERIFY_ATTEMPTS = 5;

/** Cryptographically secure 8-digit numeric code (zero-padded). */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison against the stored hash — avoids timing attacks. */
export function codeMatches(code: string, hash: string): boolean {
  const a = Buffer.from(hashOtpCode(code));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
