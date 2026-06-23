import type { ReactNode } from "react";

/**
 * Shared presentational primitives for the premium analysis view. They follow the
 * design system (bg-base page, bg-surface cards, blue accent, score-* signals, RTL)
 * defined in DESIGN.md / globals.css.
 */

/**
 * Semantic color tokens for a 0-100 score: score-high ≥70, score-mid 40-69,
 * score-low <40. `stroke` stays a literal hex for SVG presentation attributes
 * (CSS vars aren't reliable there); class names use the theme utilities.
 */
export function scoreColor(score: number) {
  if (score >= 70)
    return {
      text: "text-score-high",
      bar: "bg-score-high",
      stroke: "#00D4A0",
    };
  if (score >= 40)
    return {
      text: "text-score-mid",
      bar: "bg-score-mid",
      stroke: "#F5A623",
    };
  return {
    text: "text-score-low",
    bar: "bg-score-low",
    stroke: "#FF4D6A",
  };
}

/** Card section matching the existing analysis cards. */
export function Panel({
  title,
  eyebrow,
  children,
  className,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[12px] border border-zinc-800 bg-zinc-900 p-6 ${
        className ?? ""
      }`}
    >
      {(title || eyebrow) && (
        <div className="mb-4">
          {eyebrow && (
            <p className="text-xs font-medium uppercase text-zinc-500">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

const PILL_TONES = {
  neutral: "bg-zinc-800 text-zinc-300 ring-zinc-700",
  positive: "bg-score-high/10 text-score-high ring-score-high/25",
  negative: "bg-score-low/10 text-score-low ring-score-low/25",
  warn: "bg-score-mid/10 text-score-mid ring-score-mid/25",
  info: "bg-primary/10 text-primary ring-primary/25",
} as const;

/** Small rounded chip. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof PILL_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm ring-1 ring-inset ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
