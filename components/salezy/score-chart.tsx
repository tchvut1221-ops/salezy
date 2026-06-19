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

const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
});

/** Line chart of score-per-call over time, with a linear trend line. v2-only, non-null scores. */
export function ScoreChart({ points }: { points: ScorePoint[] }) {
  const trend = linearRegression(points.map((p) => p.overall));

  const data = points.map((p, i) => ({
    date: DATE_FORMATTER.format(new Date(p.created_at)),
    score: Math.round(p.overall),
    trend: Math.round(trend[i] * 10) / 10,
  }));

  return (
    <Panel eyebrow="מגמה" title="ציון לאורך זמן">
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="#71717a" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                color: "#e4e4e7",
              }}
              labelStyle={{ color: "#a1a1aa" }}
            />
            <Line
              type="monotone"
              dataKey="score"
              name="ציון"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ r: 3, fill: "#34d399" }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="trend"
              name="מגמה"
              stroke="#71717a"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
