import { Panel, Stat } from "./ui";
import { ScoreRing } from "./score-ring";
import { Sparkline } from "./sparkline";
import { PERSONALITY_TYPE_META } from "@/lib/disc-reference";
import type { AnalyticsStats, ScorePoint } from "@/lib/analytics";

/** Enough points to read a shape, few enough that each one is still visible. */
const SPARKLINE_POINTS = 12;

/**
 * The dashboard's headline widget: average score as a ring, the recent trend
 * as a sparkline, and the three supporting numbers.
 *
 * Replaces StatsBar, which rendered the same four figures as four equal-weight
 * numbers — with no hierarchy, the average score (the one figure a user
 * actually opens the dashboard for) read no louder than the call count. Same
 * data, same `computeStats` source, no new query: the sparkline reuses the
 * exact `scorePoints` array the ScoreChart below it already receives.
 */
export function PerformanceSummary({
  stats,
  points,
  className,
}: {
  stats: AnalyticsStats;
  points: ScorePoint[];
  /** Grid placement from the dashboard (e.g. "lg:col-span-2"). */
  className?: string;
}) {
  const deltaText =
    stats.improvementDelta === null
      ? "—"
      : `${stats.improvementDelta >= 0 ? "+" : ""}${stats.improvementDelta.toFixed(1)}`;
  const deltaColor =
    stats.improvementDelta === null
      ? "text-zinc-400"
      : stats.improvementDelta > 0
        ? "text-score-high"
        : stats.improvementDelta < 0
          ? "text-score-low"
          : "text-zinc-400";

  const personalityText = stats.mostCommonPersonality
    ? PERSONALITY_TYPE_META[stats.mostCommonPersonality].he
    : "—";

  const sparkPoints = points.slice(-SPARKLINE_POINTS);

  return (
    <Panel eyebrow="סטטיסטיקות" title="סיכום ביצועים" className={className}>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <ScoreRing value={stats.averageScore} caption="מתוך 100" />
          <span className="text-caption text-zinc-500">ציון ממוצע</span>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
          {sparkPoints.length > 1 && (
            <div>
              <span className="text-caption text-zinc-500">
                מגמת {sparkPoints.length} השיחות האחרונות
              </span>
              <Sparkline values={sparkPoints.map((p) => p.overall)} className="mt-2" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            <Stat label="מספר שיחות" value={String(stats.callCount)} />
            <Stat label="שיפור" value={deltaText} valueClassName={deltaColor} />
            <Stat label="טיפוס לקוח נפוץ" value={personalityText} mono={false} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
