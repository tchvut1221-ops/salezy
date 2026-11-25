"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, EmptyNote } from "./ui";
import {
  CHART_AREA_OPACITY,
  CHART_AXIS_PROPS,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_SCORE_LINE_COLOR,
  CHART_TOOLTIP_BAR_CURSOR,
  CHART_TOOLTIP_LINE_CURSOR,
  CHART_Y_AXIS_WIDTH,
  SCORECARD_TICKS,
  formatChartDates,
} from "./chart-theme";
import {
  ChartTooltipContent,
  SCORE_ACTIVE_DOT,
  categoryTick,
  scoreSeriesDot,
  scorecardBar,
} from "./chart-marks";
import type { PatternsData } from "@/lib/patterns";

const CONSISTENCY_LABEL: Record<string, string> = {
  stable: "אתה עקבי — עקביות היא סמן היכר של מצטיינים (Gong Labs)",
  somewhat_variable: "יחס הדיבור שלך משתנה במידה בין שיחות",
  highly_variable: "יחס הדיבור שלך משתנה מאוד בין שיחות — נסה לשמור על עקביות",
};

// D7: same stagger convention as analysis-sections.tsx's own DELAY helper.
const DELAY = (step: number) => ({ animationDelay: `${step * 60}ms` });

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
    <div className="space-y-6">
      <div className="animate-fade-up" style={DELAY(0)}>
        <Panel eyebrow="מגמה" title="ציוני קטגוריות — ממוצע">
          <div className="h-64 w-full" dir="ltr" role="img" aria-label={categorySummary}>
            <div aria-hidden="true" className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryAverages} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART_GRID_STROKE} />
                  {/* interval 0 + a wrapping tick: every category keeps its label. */}
                  <XAxis
                    dataKey="label"
                    {...CHART_AXIS_PROPS}
                    tick={categoryTick}
                    interval={0}
                    height={48}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={SCORECARD_TICKS}
                    width={CHART_Y_AXIS_WIDTH}
                    {...CHART_AXIS_PROPS}
                    tick={CHART_AXIS_TICK}
                  />
                  <Tooltip content={ChartTooltipContent} cursor={CHART_TOOLTIP_BAR_CURSOR} />
                  <Bar dataKey="average" name="ממוצע" maxBarSize={40} shape={scorecardBar} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>
      </div>

      {trendData.length > 1 && (
        <div className="animate-fade-up" style={DELAY(1)}>
          <Panel eyebrow="מגמה" title="ציון סקורקארד כולל לאורך זמן">
            <div className="h-56 w-full" dir="ltr" role="img" aria-label={trendSummary}>
              <div aria-hidden="true" className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 20, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART_GRID_STROKE} />
                    <XAxis
                      dataKey="date"
                      {...CHART_AXIS_PROPS}
                      tick={CHART_AXIS_TICK}
                      minTickGap={24}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 5]}
                      ticks={SCORECARD_TICKS}
                      width={CHART_Y_AXIS_WIDTH}
                      {...CHART_AXIS_PROPS}
                      tick={CHART_AXIS_TICK}
                    />
                    <Tooltip content={ChartTooltipContent} cursor={CHART_TOOLTIP_LINE_CURSOR} />
                    <Area
                      type="linear"
                      dataKey="score"
                      stroke="none"
                      fill={CHART_SCORE_LINE_COLOR}
                      fillOpacity={CHART_AREA_OPACITY}
                      tooltipType="none"
                      activeDot={false}
                    />
                    {/* name: the same series word ScoreChart uses; without it the
                        tooltip showed the raw data key "score". */}
                    <Line
                      type="linear"
                      dataKey="score"
                      name="ציון"
                      stroke={CHART_SCORE_LINE_COLOR}
                      strokeWidth={2}
                      dot={scoreSeriesDot}
                      activeDot={SCORE_ACTIVE_DOT}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <div className="animate-fade-up" style={DELAY(2)}>
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
            <EmptyNote>אין מספיק נתוני יחס דיבור עדיין</EmptyNote>
          )}
        </Panel>
      </div>

      <div className="animate-fade-up" style={DELAY(3)}>
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
            <EmptyNote>לא זוהו דפוסים חוזרים משמעותיים עדיין — המשך להעלות שיחות.</EmptyNote>
          )}
        </Panel>
      </div>

      {data.coaching && (
        <div className="animate-fade-up" style={DELAY(4)}>
          <Panel title="אימון מבוסס דפוסים" className="border-primary/25 bg-primary/5">
            <p className="text-sm text-zinc-300">{data.coaching.finding.message}</p>
            <p className="mt-3 font-medium text-zinc-100">
              בשבוע הקרוב: {data.coaching.action}
            </p>
            <p className="mt-1 text-sm text-zinc-400">{data.coaching.how}</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
