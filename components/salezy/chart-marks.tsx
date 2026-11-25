"use client";

import {
  Rectangle,
  Text,
  type BarShapeProps,
  type DotItemDotProps,
  type TooltipContentProps,
  type XAxisTickContentProps,
} from "recharts";
import { CHART_SCORE_LINE_COLOR, formatChartValue, scorecardBandColor } from "./chart-theme";

/**
 * The rendered marks shared by every chart (styling constants live in
 * chart-theme.ts). Each is passed to a Recharts prop (`dot`, `content`,
 * `tick`, `shape`) rather than wrapped as a component, because Recharts
 * only recognises its own series and axis components as direct children.
 */

/**
 * Dots for the score series: 2px points along the line, and the most recent
 * call as a 4px point ringed in the card's surface with its value above it,
 * so "where am I now" reads without hovering.
 */
export function scoreSeriesDot({ cx, cy, index, points, value }: DotItemDotProps) {
  if (typeof cx !== "number" || typeof cy !== "number") return <g key={`dot-${index}`} />;
  if (index !== points.length - 1) {
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={2} fill={CHART_SCORE_LINE_COLOR} />;
  }
  return (
    <g key={`dot-${index}`}>
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={CHART_SCORE_LINE_COLOR}
        stroke="var(--bg-surface)"
        strokeWidth={2}
      />
      {typeof value === "number" && (
        <text
          data-last-point-label=""
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fill="var(--text-primary)"
          fontFamily="var(--font-jetbrains-mono)"
          fontSize={13}
          fontWeight={600}
        >
          {formatChartValue(value)}
        </text>
      )}
    </g>
  );
}

/** Hover point: the same 4px ringed dot as the last point. */
export const SCORE_ACTIVE_DOT = {
  r: 4,
  fill: CHART_SCORE_LINE_COLOR,
  stroke: "var(--bg-surface)",
  strokeWidth: 2,
};

/**
 * Tooltip body: the label (date or category) as a 13px caption, then each
 * series as its Hebrew name and its value in 14px JetBrains Mono. The value
 * is in the primary text colour, not the series colour, so it stays legible
 * on the elevated surface whatever the series is.
 */
export function ChartTooltipContent({ active, payload, label }: TooltipContentProps) {
  const rows = (payload ?? []).filter((p) => p.type !== "none" && typeof p.value === "number");
  if (!active || rows.length === 0) return null;
  const text = label == null ? "" : String(label);
  // Dates are numerals (JetBrains Mono, LTR); category names are Hebrew (sans).
  const numeric = /^[\d.\/\s-]+$/.test(text);
  return (
    <div dir="rtl" className="rounded-lg border border-border bg-elevated px-3 py-2">
      {text !== "" && (
        <p
          dir={numeric ? "ltr" : undefined}
          className={`text-caption text-zinc-400 ${numeric ? "text-end font-mono tabular-nums" : ""}`}
        >
          {text}
        </p>
      )}
      {rows.map((row) => (
        <p key={String(row.dataKey ?? row.name)} className="mt-1 flex items-baseline justify-between gap-4">
          <span className="text-caption text-zinc-400">{row.name}</span>
          <span dir="ltr" className="font-mono text-sm font-medium tabular-nums text-foreground">
            {formatChartValue(row.value as number)}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Category tick for Hebrew labels (the scorecard categories): the sans
 * family Hebrew is set in, 13px, wrapped at spaces to the width of its own
 * band, so every category keeps its label at every width. With Recharts'
 * default single-line ticks, two of the five labels dropped out at 390px.
 * No maxLines: Recharts truncates with an ellipsis mid-word when a single
 * word is wider than the band ("בהתנגדויות" at 390px), and a cut Hebrew word
 * reads worse than one that runs a few pixels into its neighbour's free space.
 */
export function categoryTick({ x, y, payload }: XAxisTickContentProps) {
  const band = (payload.offset ?? 0) * 2;
  return (
    <Text
      x={x}
      y={y}
      width={band > 8 ? band - 8 : undefined}
      textAnchor="middle"
      verticalAnchor="start"
      fill="var(--text-secondary)"
      fontSize={13}
      lineHeight={16}
      style={{ fontSize: 13 }}
    >
      {String(payload.value)}
    </Text>
  );
}

/** A scorecard bar, coloured by the band its own average falls in; 2px top corners. */
export function scorecardBar({ x, y, width, height, value }: BarShapeProps) {
  const average = Array.isArray(value) ? value[1] : value;
  return (
    <Rectangle
      x={x}
      y={y}
      width={width}
      height={height}
      radius={[2, 2, 0, 0]}
      fill={scorecardBandColor(average)}
    />
  );
}
