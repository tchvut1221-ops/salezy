"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "./ui";
import {
  CHART_AXIS_STROKE,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_SCORE_LINE_COLOR,
  CHART_TOOLTIP_CONTENT_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TREND_LINE_COLOR,
} from "./chart-theme";
import type { ScorePoint } from "@/lib/analytics";

/**
 * Trend line = simple linear regression (least squares) over the call index,
 * not a moving average — with as few as 3-5 calls a moving average is mostly
 * flat/undefined at the edges, while a regression line gives a clear
 * "trending up / down" signal from the first data point.
 */
function linearRegression(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [values[0]];

  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = values.reduce((s, y) => s + y, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  return xs.map((x) => slope * x + intercept);
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

/** Line chart of score-per-call over time, with a linear trend line. v2-only, non-null scores. */
export function ScoreChart({ points }: { points: ScorePoint[] }) {
  const trend = linearRegression(points.map((p) => p.overall));

  // Only show the year once calls actually span more than one — otherwise
  // "01/01" x2 from two different years would look like a duplicate point.
  const years = new Set(points.map((p) => new Date(p.created_at).getFullYear()));
  const dateFormatter = years.size > 1 ? DAY_MONTH_YEAR_FORMATTER : DAY_MONTH_FORMATTER;

  const data = points.map((p, i) => ({
    date: dateFormatter.format(new Date(p.created_at)),
    score: Math.round(p.overall),
    trend: Math.round(trend[i] * 10) / 10,
  }));

  const trendDirection =
    trend.length < 2
      ? "יציבה"
      : trend[trend.length - 1] > trend[0] + 0.5
        ? "עולה"
        : trend[trend.length - 1] < trend[0] - 0.5
          ? "יורדת"
          : "יציבה";
  const chartSummary = `גרף ציון לאורך זמן: ${data.length} שיחות, מ-${data[0]?.score ?? 0} ל-${
    data[data.length - 1]?.score ?? 0
  } מתוך 100, מגמה ${trendDirection}.`;

  return (
    <Panel eyebrow="מגמה" title="ציון לאורך זמן">
      <div className="h-64 w-full" dir="ltr" role="img" aria-label={chartSummary}>
        <div aria-hidden="true" className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
              <XAxis dataKey="date" stroke={CHART_AXIS_STROKE} tick={CHART_AXIS_TICK} />
              <YAxis domain={[0, 100]} stroke={CHART_AXIS_STROKE} tick={CHART_AXIS_TICK} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
              />
              <Line
                type="monotone"
                dataKey="score"
                name="ציון"
                stroke={CHART_SCORE_LINE_COLOR}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_SCORE_LINE_COLOR }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="trend"
                name="מגמה"
                stroke={CHART_TREND_LINE_COLOR}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Panel>
  );
}
