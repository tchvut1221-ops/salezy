import { Panel, scoreColor } from "./ui";
import { PERSONALITY_TYPE_META } from "@/lib/disc-reference";
import type { AnalyticsStats } from "@/lib/analytics";

function Metric({
  label,
  value,
  valueClassName,
  mono = true,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  /** Numeric metrics render in JetBrains Mono; the Hebrew personality label does not. */
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-zinc-500">{label}</span>
      <span
        className={`text-2xl font-bold tabular-nums ${mono ? "font-mono" : ""} ${
          valueClassName ?? "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Four headline metrics across the user's v2 (scored) calls:
 * total calls, average overall score, improvement delta, and the most
 * common customer personality type detected.
 *
 * `improvementDelta` definition (computed in lib/analytics.ts): average
 * score of the more recent half of calls minus the average of the older
 * half, split chronologically down the middle. Null (rendered as "—") when
 * there are fewer than 2 calls to compare.
 */
export function StatsBar({ stats }: { stats: AnalyticsStats }) {
  const avgColor = scoreColor(stats.averageScore);

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

  return (
    <Panel eyebrow="סטטיסטיקות" title="סיכום ביצועים">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Metric label="מספר שיחות" value={String(stats.callCount)} />
        <Metric
          label="ציון ממוצע"
          value={stats.averageScore.toFixed(1)}
          valueClassName={avgColor.text}
        />
        <Metric label="שיפור" value={deltaText} valueClassName={deltaColor} />
        <Metric label="טיפוס לקוח נפוץ" value={personalityText} mono={false} />
      </div>
    </Panel>
  );
}
