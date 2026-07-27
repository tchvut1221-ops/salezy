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
 */

export const CHART_GRID_STROKE = "var(--border)";
export const CHART_AXIS_STROKE = "var(--border)";
export const CHART_AXIS_TICK = {
  fill: "var(--text-secondary)",
  fontFamily: "var(--font-jetbrains-mono)",
  fontSize: 12,
};

export const CHART_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
};
export const CHART_TOOLTIP_LABEL_STYLE = { color: "var(--text-secondary)" };

export const CHART_SCORE_LINE_COLOR = "var(--score-high)";
export const CHART_TREND_LINE_COLOR = "var(--border-strong)";

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
