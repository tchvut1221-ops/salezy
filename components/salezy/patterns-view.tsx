"use client";

import {
  Bar,
  BarChart,
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
  formatChartDates,
} from "./chart-theme";
import type { PatternsData } from "@/lib/patterns";

const CONSISTENCY_LABEL: Record<string, string> = {
  stable: "אתה עקבי — עקביות היא סמן היכר של מצטיינים (Gong Labs)",
  somewhat_variable: "יחס הדיבור שלך משתנה במידה בין שיחות",
  highly_variable: "יחס הדיבור שלך משתנה מאוד בין שיחות — נסה לשמור על עקביות",
};

export function PatternsView({ data }: { data: Extract<PatternsData, { eligible: true }> }) {
  const scoredTrend = data.trend.filter(
    (t): t is { createdAt: string; overall: number } => t.overall != null
  );
  const trendDates = formatChartDates(scoredTrend.map((t) => t.createdAt));
  const trendData = scoredTrend.map((t, i) => ({ date: trendDates[i], score: t.overall }));

  const categoryAverages = data.categoryAverages.map((c) => ({
    label: c.label,
    average: c.average ?? 0,
  }));
  const categorySummary = `גרף עמודות: ציון ממוצע לכל קטגוריה מתוך 5 — ${categoryAverages
    .map((c) => `${c.label}: ${c.average.toFixed(1)}`)
    .join(", ")}.`;

  const trendSummary =
    trendData.length > 1
      ? `גרף קו: ציון סקורקארד כולל לאורך ${trendData.length} שיחות, מ-${trendData[0].score.toFixed(
          1
        )} ל-${trendData[trendData.length - 1].score.toFixed(1)} מתוך 5.`
      : "";

  return (
    <div className="mt-8 space-y-6">
      <Panel eyebrow="מגמה" title="ציוני קטגוריות — ממוצע">
        <div className="h-64 w-full" dir="ltr" role="img" aria-label={categorySummary}>
          <div aria-hidden="true" className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryAverages}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey="label" stroke={CHART_AXIS_STROKE} tick={CHART_AXIS_TICK} />
                <YAxis domain={[0, 5]} stroke={CHART_AXIS_STROKE} tick={CHART_AXIS_TICK} />
                <Tooltip contentStyle={CHART_TOOLTIP_CONTENT_STYLE} />
                <Bar dataKey="average" name="ממוצע" fill={CHART_SCORE_LINE_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      {trendData.length > 1 && (
        <Panel eyebrow="מגמה" title="ציון סקורקארד כולל לאורך זמן">
          <div className="h-56 w-full" dir="ltr" role="img" aria-label={trendSummary}>
            <div aria-hidden="true" className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="date" stroke={CHART_AXIS_STROKE} tick={CHART_AXIS_TICK} />
                  <YAxis domain={[0, 5]} stroke={CHART_AXIS_STROKE} tick={CHART_AXIS_TICK} />
                  <Tooltip contentStyle={CHART_TOOLTIP_CONTENT_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={CHART_SCORE_LINE_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART_SCORE_LINE_COLOR }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>
      )}

      <Panel eyebrow="עקביות" title="יחס דיבור/הקשבה">
        {data.talkRatioStats ? (
          <div>
            <p dir="ltr" className="font-mono text-2xl font-bold tabular-nums text-primary">
              {data.talkRatioStats.average}%
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {CONSISTENCY_LABEL[data.talkRatioStats.consistency]}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">אין מספיק נתוני יחס דיבור עדיין</p>
        )}
      </Panel>

      <Panel title="דפוסים חוזרים">
        {data.findings.length > 0 ? (
          <ul className="space-y-3">
            {data.findings.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300"
              >
                {f.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            לא זוהו דפוסים חוזרים משמעותיים עדיין — המשך להעלות שיחות.
          </p>
        )}
      </Panel>

      {data.coaching && (
        <Panel title="אימון מבוסס דפוסים" className="border-primary/25 bg-primary/5">
          <p className="text-sm text-zinc-300">{data.coaching.finding.message}</p>
          <p className="mt-3 font-medium text-zinc-100">
            בשבוע הקרוב: {data.coaching.action}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{data.coaching.how}</p>
        </Panel>
      )}
    </div>
  );
}
