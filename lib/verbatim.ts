/** Strips Hebrew niqqud/cantillation and common punctuation for loose substring matching. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'׳״.,!?;:()\-–—]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `quote` can be found (loosely normalized) inside an
 * already-normalized transcript. Callers normalize the transcript once via
 * normalizeForMatch and reuse it across multiple quote checks, rather than
 * re-normalizing the whole transcript per quote.
 */
export function isVerbatimQuote(quote: string, normalizedTranscript: string): boolean {
  const q = normalizeForMatch(quote);
  return q.length >= 2 && normalizedTranscript.includes(q);
}
