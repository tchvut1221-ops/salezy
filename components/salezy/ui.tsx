import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Shared presentational primitives for the premium analysis view. They follow the
 * design system (bg-base page, bg-surface cards, blue accent, score-* signals, RTL)
 * defined in DESIGN.md / globals.css.
 *
 * NOTE: this file must stay free of React hook imports (useState/useEffect/useRef).
 * Several consumers (e.g. app/dashboard/page.tsx) import Panel/Pill/scoreColor from
 * here without their own "use client" directive — they're Server Components. Since
 * Next.js's Server/Client boundary check is per-module (not per-symbol-usage), any
 * hook import at this file's top level would force this whole file, and therefore
 * every Server Component that imports from it, into the client bundle and fail the
 * build ("You're importing a module that depends on useState/useEffect/useRef into
 * a React Server Component module"). useCountUp lives in ./use-count-up instead for
 * this reason — see that file.
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

/** Color bands for the 1-5 scorecard scale: 4-5 high, 3 mid, 1-2 low. */
export function scorecardScoreColor(score: number) {
  if (score >= 4) return { text: "text-score-high", dot: "bg-score-high" };
  if (score === 3) return { text: "text-score-mid", dot: "bg-score-mid" };
  return { text: "text-score-low", dot: "bg-score-low" };
}

/**
 * THE card. Every boxed surface in the app goes through Panel (or at least
 * copies its exact wrapper classes) — one radius convention (rounded-xl,
 * which the theme maps to the design system's 12px), one border, one bg.
 */
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
      className={`rounded-xl border border-zinc-800 bg-zinc-900 p-6 ${
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

/**
 * The one button recipe. Exported separately from <Button> so links can wear
 * the same clothes: <Link className={buttonVariants({ size: "lg" })}>.
 * rounded-lg = the design system's 8px control radius (cards are 12px).
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // bg-accent-blue-deep, not bg-primary: white text (#F0F0FF) on the
        // plain accent blue (#4D7EFF) is only 3.24:1, below the 4.5:1 AA
        // minimum for text. The deepened shade clears ~4.8:1 while --primary
        // itself (used for text/border/ring elsewhere) stays untouched.
        primary:
          "bg-accent-blue-deep text-primary-foreground hover:bg-accent-blue-deep/90",
        secondary:
          "border border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-foreground",
        ghost: "text-zinc-400 hover:text-foreground",
        danger:
          "border border-score-low/30 text-score-low hover:bg-score-low/10",
      },
      size: {
        sm: "px-2.5 py-1.5 text-xs",
        md: "px-4 py-2.5 text-sm",
        lg: "px-8 py-3 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

/**
 * Shared button. Defaults to type="button" (NOT the browser's in-form
 * "submit" default) — form submitters must say type="submit" explicitly, so
 * a stray action button inside a form can never submit it by accident.
 */
export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
