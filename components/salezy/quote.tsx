import type { ReactNode } from "react";

/**
 * Wraps a verbatim transcript quote in Hebrew gershayim (״), rendered as
 * &rdquo;…&ldquo; — closing-quote-glyph first, opening-quote-glyph last.
 * That's intentional, not a typo: in RTL text flow the visual (left-to-right
 * glyph shape) curl needs to point inward on each side, which is the
 * *reverse* of how these entities read in LTR markup. Centralized here so
 * the choice is made once and documented, instead of copied blind into
 * every card that quotes the transcript (key-moments.tsx, scorecard.tsx,
 * stage-analysis.tsx all did this independently before).
 *
 * Deliberately just the glyph-wrapped text, not a wrapper element — the
 * three call sites use different block elements (plain `<p>`, `<blockquote>`)
 * with different styling, so this stays a drop-in replacement for the quote
 * text itself: `<blockquote className="..."><Quote>{text}</Quote></blockquote>`.
 */
export function Quote({ children }: { children: ReactNode }) {
  return (
    <>
      &rdquo;{children}&ldquo;
    </>
  );
}
