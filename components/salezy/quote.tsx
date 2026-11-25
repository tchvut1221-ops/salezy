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
 * Deliberately just the glyph-wrapped text, not a wrapper element — use
 * QuoteBlock below for the quote's on-page treatment.
 */
export function Quote({ children }: { children: ReactNode }) {
  return (
    <>
      &rdquo;{children}&ldquo;
    </>
  );
}

/**
 * The one way a customer's or rep's own words appear on the analysis screen
 * (the quote voice): a 2px --border-strong rule on the start edge, the words
 * at 16px in the primary text colour, no background, no tint, no colour of
 * its own — so a quote never competes with a score, a DISC colour or an
 * insight. An optional note (what the quote means) follows at 14px.
 *
 * `onJump` makes the quote a button that scrolls to it in the transcript
 * (scroll-to-quote.ts), with the hover underline and the accent focus ring.
 */
export function QuoteBlock({
  children,
  note,
  onJump,
  className,
}: {
  children: ReactNode;
  note?: ReactNode;
  onJump?: () => void;
  className?: string;
}) {
  return (
    <figure className={`border-s-2 border-border-strong ps-4 ${className ?? ""}`}>
      <blockquote className="text-body text-zinc-100">
        {onJump ? (
          <button
            type="button"
            onClick={onJump}
            title="קפיצה למיקום בתמלול"
            className="rounded-sm text-start underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Quote>{children}</Quote>
          </button>
        ) : (
          <Quote>{children}</Quote>
        )}
      </blockquote>
      {note && <figcaption className="mt-1 text-sm leading-relaxed text-zinc-400">{note}</figcaption>}
    </figure>
  );
}
