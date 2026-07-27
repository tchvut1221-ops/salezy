import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

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
 * The base surface treatment shared by every boxed element in the app — one
 * radius convention (rounded-xl, the design system's 12px), one border, one
 * bg. Panel and Card both build on this so the two stay in lockstep instead
 * of drifting into slightly-different card shells over time.
 */
const CARD_CLASS = "rounded-xl border border-zinc-800 bg-zinc-900 p-6";

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
    <section className={`${CARD_CLASS} ${className ?? ""}`}>
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

/**
 * Bare surface — Panel's exact visual treatment without Panel's built-in
 * eyebrow/title header. For shells that need the surface but not a header
 * (auth card, error/404 cards, dialogs) — several of these previously
 * hand-rolled this same class string independently (D0 audit finding).
 */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${CARD_CLASS} ${className ?? ""}`}>{children}</div>;
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

/**
 * Text input — bg-elevated + hairline border + primary focus ring. Label is
 * always rendered separately, above the field, by the caller (DESIGN.md:
 * never floating-label — breaks Hebrew RTL alignment). Matches the classes
 * login's email/OTP fields already used; also the fix for the one input
 * that had drifted to a different background (practice-dialog's composer).
 */
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-zinc-700 bg-elevated px-4 py-2.5 text-foreground placeholder-zinc-500 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring ${
        className ?? ""
      }`}
      {...props}
    />
  );
}

/**
 * Linear-fill meter — a track + fill bar for a plain 0-100 value. NOT for
 * segmented multi-step indicators (the analysis pipeline stepper, the
 * section-opened count in analysis-sections.tsx) or RTL-anchored/
 * bidirectional bars (ScoreGauge's sub-scores, Scorecard's talk-ratio
 * track) — those have their own geometry and stay purpose-built.
 * `ariaLabel` is optional: when omitted the bar is purely decorative,
 * matching call sites that already surface the value as adjacent visible
 * text (screen readers would otherwise hear the number twice).
 */
export function Meter({
  value,
  size = "md",
  trackClassName,
  fillClassName,
  ariaLabel,
}: {
  value: number;
  size?: "xs" | "sm" | "md";
  trackClassName?: string;
  fillClassName?: string;
  ariaLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const height = size === "xs" ? "h-1" : size === "sm" ? "h-1.5" : "h-2";
  const ariaProps = ariaLabel
    ? {
        role: "progressbar" as const,
        "aria-label": ariaLabel,
        "aria-valuenow": Math.round(pct),
        "aria-valuemin": 0,
        "aria-valuemax": 100,
      }
    : {};
  return (
    <div
      className={`${height} w-full overflow-hidden rounded-full bg-zinc-800 ${
        trackClassName ?? ""
      }`}
      {...ariaProps}
    >
      <div
        className={
          fillClassName ??
          "h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
        }
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Shimmer placeholder rectangle. Compose with sizing: `<Skeleton className="h-4 w-24" />`. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-800 ${className ?? ""}`} />;
}

/**
 * Label-above-value stat cell (StatsBar's building block, factored out so
 * D2's dashboard widgets can reuse it without re-implementing the same
 * label/value/mono handling).
 */
export function Stat({
  label,
  value,
  valueClassName,
  mono = true,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  /** Numeric values render in JetBrains Mono; non-numeric ones (e.g. a
   *  Hebrew personality label) should pass mono={false}. */
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-zinc-500">{label}</span>
      <span
        className={`text-2xl font-bold tabular-nums ${mono ? "font-mono" : ""} ${
          valueClassName ?? "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Dashed-border empty state — matches the dashboard/patterns "not enough
 * data yet" cards exactly (D0 audit: previously duplicated markup, no icon
 * support). Icon is optional so D1's migration of the two existing call
 * sites stays visually identical; D6 (onboarding) is where illustrations
 * get wired in for real.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center ${
        className ?? ""
      }`}
    >
      {Icon && (
        <Icon
          className="mx-auto mb-3 h-8 w-8 text-zinc-600"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      )}
      <p className="font-medium text-zinc-200">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const ALERT_TONES = {
  error: "border-score-low/30 bg-score-low/10",
  warn: "border-score-mid/30 bg-score-mid/10",
  info: "border-primary/25 bg-primary/5",
} as const;

/**
 * Bordered/tinted callout box — for block-level state messages (e.g. the
 * analysis failure states). NOT for single-line inline field validation:
 * login/upload keep their plain `<p role="alert">` — wrapping one line of
 * validation text in a padded box would be a visual regression there.
 */
export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: keyof typeof ALERT_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={`rounded-lg border p-5 ${ALERT_TONES[tone]} ${className ?? ""}`}>
      {children}
    </div>
  );
}
