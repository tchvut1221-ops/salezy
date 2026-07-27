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
