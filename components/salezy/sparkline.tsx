import { CHART_SCORE_LINE_COLOR } from "./chart-theme";

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 20;

/**
 * A trend line reduced to its shape: no axes, no labels, no tooltip. Meant to
 * sit next to a number (the ScoreRing / a stat) and answer "which way is this
 * going?" in one glance — the full, readable version of the same data is the
 * ScoreChart further down the dashboard.
 *
 * Renders nothing below two points (a single point has no direction to show).
 * Uses the same series color as ScoreChart's score line, via chart-theme, so
 * the condensed and full views obviously refer to the same thing.
 *
 * `vectorEffect="non-scaling-stroke"` keeps the 1.5px stroke honest while the
 * viewBox is stretched to whatever width the container gives it. Wrapped in
 * `dir="ltr"` so time always runs oldest-left → newest-right, matching
 * ScoreChart, regardless of the RTL page. It's marked aria-hidden because the
 * accessible reading lives in the adjacent text/chart, not in the shape.
 */
export function Sparkline({
  values,
  className,
}: {
  /** Chronological (oldest first). */
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series (max === min) would divide by zero; render it as a centered
  // straight line instead.
  const span = max - min || 1;
  const inset = 1.5; // keeps the stroke from being clipped at the edges

  const points = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * VIEW_WIDTH;
      const y =
        max === min
          ? VIEW_HEIGHT / 2
          : VIEW_HEIGHT - inset - ((value - min) / span) * (VIEW_HEIGHT - inset * 2);
      return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    })
    .join(" ");

  return (
    <span dir="ltr" className={`block ${className ?? ""}`} aria-hidden="true">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-5 w-full"
        fill="none"
      >
        <polyline
          points={points}
          stroke={CHART_SCORE_LINE_COLOR}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
