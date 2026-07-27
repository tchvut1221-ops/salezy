"use client";

import { useCountUp } from "./use-count-up";
import { scoreColor } from "./ui";

/**
 * Average-score ring for the dashboard: a CSS `conic-gradient` sweep from 12
 * o'clock, banded by scoreColor() (≥70 / 40-69 / <40), with the value counting
 * up in the middle.
 *
 * Deliberately NOT the same construction as ScoreGauge (components/salezy/
 * score-gauge.tsx), which stays an SVG semicircle for a single call's score:
 * the dashboard's aggregate reading should be visually distinct from the
 * per-call one at a glance, not a smaller copy of it. Neither replaces the
 * other.
 *
 * `dir="ltr"` because the content is a numeral and a swept arc — both read
 * left-to-right regardless of the surrounding RTL page (DESIGN.md).
 */
export function ScoreRing({
  value,
  caption,
  className,
}: {
  /** 0-100. */
  value: number;
  caption?: string;
  className?: string;
}) {
  const animated = useCountUp(value);
  const sc = scoreColor(value);
  const swept = Math.max(0, Math.min(100, animated));

  return (
    <div
      dir="ltr"
      className={`relative h-32 w-32 shrink-0 rounded-full ${className ?? ""}`}
      style={{
        // The `0` second stop is a hard cut, not a gradient — a fill/track
        // boundary, not a blend (DESIGN.md: no gradients).
        background: `conic-gradient(${sc.stroke} ${swept}%, var(--bg-elevated) 0)`,
      }}
    >
      <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-surface">
        <span className={`font-mono text-3xl font-bold tabular-nums ${sc.text}`}>
          {animated.toFixed(1)}
        </span>
        {caption && <span className="text-caption text-zinc-500">{caption}</span>}
      </div>
    </div>
  );
}
