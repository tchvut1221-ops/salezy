import type { ReactNode } from "react";

/**
 * Shared presentational primitives for the premium analysis view. They extend the
 * app's existing dark language (zinc-950 page, zinc-900 cards, emerald accent, RTL)
 * rather than introducing a new one.
 */

/** Semantic color tokens for a 0-100 score: --score-high ≥70, --score-mid 40-69, --score-low <40. */
export function scoreColor(score: number) {
  if (score >= 70)
    return {
      text: "text-[#00D4A0]",
      bar: "bg-[#00D4A0]",
      stroke: "#00D4A0",
    };
  if (score >= 40)
    return {
      text: "text-[#F5A623]",
      bar: "bg-[#F5A623]",
      stroke: "#F5A623",
    };
  return {
    text: "text-[#FF4D6A]",
    bar: "bg-[#FF4D6A]",
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
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {title}
            </h2>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

const PILL_TONES = {
  neutral: "bg-zinc-800 text-zinc-300 ring-zinc-700",
  positive: "bg-[#00D4A0]/10 text-[#00D4A0] ring-[#00D4A0]/25",
  negative: "bg-[#FF4D6A]/10 text-[#FF4D6A] ring-[#FF4D6A]/25",
  warn: "bg-[#F5A623]/10 text-[#F5A623] ring-[#F5A623]/25",
  info: "bg-[#4D7EFF]/10 text-[#4D7EFF] ring-[#4D7EFF]/25",
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
