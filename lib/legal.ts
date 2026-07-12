/**
 * Single source of truth for legal-document versioning. Bump a doc's version
 * whenever its content changes materially — verify-otp stamps the current
 * versions onto every new consent_log row (migration 0011), so a later
 * dispute ("what did the user actually agree to?") resolves against the
 * exact text that was live at signup, not whatever's live now.
 */
export const LEGAL_DOC_VERSIONS = {
  privacy: "1.0",
  terms: "1.0",
} as const;

export const LEGAL_DOCS_UPDATED_AT = "2026-07-12";
