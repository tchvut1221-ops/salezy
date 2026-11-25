/**
 * Shared Recharts styling — grid/axis/tooltip look identical across every
 * chart in the app (score-chart.tsx, patterns-view.tsx). Previously each
 * chart hardcoded the same handful of hex literals independently (D0 audit
 * finding); these reference the brand CSS custom properties instead, so a
 * future palette change doesn't require hunting down every chart.
 *
 * CSS custom properties resolve fine inside SVG presentation attributes
 * (stroke/fill) and inline style objects in all current browsers, so this
 * isn't a decorative "matches the palette" mapping — the chart genuinely
 * reads the live --border / --text-secondary / --score-high values.
 *
 * The instrument look (Unit 3 of the visual pass): no axis lines or tick
 * marks, horizontal hairlines only, and those hairlines sit on meaningful
 * values — the score band edges (40 / 70) or the whole steps of a 1-5 scale.
 * The rendered marks (last-point dot, tooltip, category ticks, banded bars)
 * live in chart-marks.tsx.
 */

/** Horizontal hairlines only, solid, at the Y ticks. */
export const CHART_GRID_STROKE = "var(--border)";

/** Applied to every XAxis and YAxis. */
export const CHART_AXIS_PROPS = { axisLine: false, tickLine: false, tickMargin: 8 } as const;

/** Numeric ticks (scores, dates): JetBrains Mono, 13px. */
export const CHART_AXIS_TICK = {
  fill: "var(--text-secondary)",
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 13,
};

/** Replaces the old negative left margin: the Y axis gets exactly the room its numerals need. */
export const CHART_Y_AXIS_WIDTH = 32;

/** 0-100 scores: grid lines on the band edges of scoreColor() (ui.tsx). */
export const SCORE_TICKS = [0, 40, 70, 100];
/** 1-5 scorecard values: one line per whole step. */
export const SCORECARD_TICKS = [1, 2, 3, 4, 5];

/** The hover rule on line charts. (The tooltip body itself is ChartTooltipContent in chart-marks.tsx.) */
export const CHART_TOOLTIP_LINE_CURSOR = { stroke: "var(--border-strong)", strokeWidth: 1 };
/** The hover band on bar charts. */
export const CHART_TOOLTIP_BAR_CURSOR = { fill: "var(--bg-hover)" };

export const CHART_SCORE_LINE_COLOR = "var(--score-high)";
export const CHART_TREND_LINE_COLOR = "var(--border-strong)";
/** Flat fill under the score line — one colour at low opacity, not a gradient. */
export const CHART_AREA_OPACITY = 0.08;

/**
 * Colour for a 1-5 scorecard average, by the same bands as
 * scorecardScoreColor() in ui.tsx (4+ high, 3 mid, below low), extended to
 * fractional averages: 4 and up high, 3 and up mid, below 3 low.
 */
export function scorecardBandColor(average: number): string {
  if (average >= 4) return "var(--score-high)";
  if (average >= 3) return "var(--score-mid)";
  return "var(--score-low)";
}

/** One number format for chart labels and tooltips: whole numbers stay whole, anything else gets one decimal. */
export function formatChartValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
});
const DAY_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

/**
 * Formats a list of ISO date strings for a chart's x-axis, switching to a
 * year-bearing format only when the dates actually span more than one year
 * — otherwise "01/01" x2 from two different years reads as a duplicate
 * point. Shared by score-chart.tsx and patterns-view.tsx (D3: the patterns
 * trend line previously plotted a bare 1..N call index instead of real
 * dates, discarding the createdAt the data layer already returned).
 */
export function formatChartDates(isoDates: string[]): string[] {
  const years = new Set(isoDates.map((d) => new Date(d).getFullYear()));
  const formatter = years.size > 1 ? DAY_MONTH_YEAR_FORMATTER : DAY_MONTH_FORMATTER;
  return isoDates.map((d) => formatter.format(new Date(d)));
}
