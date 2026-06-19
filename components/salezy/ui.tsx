import type { ReactNode } from "react";

/**
 * Shared presentational primitives for the premium analysis view. They extend the
 * app's existing dark language (zinc-950 page, zinc-900 cards, emerald accent, RTL)
 * rather than introducing a new one.
 */

/** Semantic color tokens for a 0-100 score: emerald ≥70, amber 40-69, red <40. */
export function scoreColor(score: number) {
  if (score >= 70)
    return {
      text: "text-emerald-400",
      bar: "bg-emerald-500",
      stroke: "#34d399",
    };
  if (score >= 40)
    return {
      text: "text-amber-400",
      bar: "bg-amber-500",
      stroke: "#fbbf24",
    };
  return {
    text: "text-red-400",
    bar: "bg-red-500",
    stroke: "#f87171",
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
      className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-6 ${
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
          {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
        </div>
      )}
      {children}
    </section>
  );
}

const PILL_TONES = {
  neutral: "bg-zinc-800 text-zinc-300 ring-zinc-700",
  positive: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  negative: "bg-red-500/10 text-red-300 ring-red-500/25",
  warn: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  info: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
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
