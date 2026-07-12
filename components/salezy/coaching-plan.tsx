import { Panel, Pill } from "./ui";
import type { CoachingPriority } from "@/types";

const PRIORITY_META: Record<
  CoachingPriority,
  { label: string; tone: "negative" | "warn" | "neutral" }
> = {
  high: { label: "עדיפות גבוהה", tone: "negative" },
  medium: { label: "עדיפות בינונית", tone: "warn" },
  low: { label: "עדיפות נמוכה", tone: "neutral" },
};

export function CoachingPlan({
  actions,
  weeklyFocus,
}: {
  actions?: Array<{ action: string; why: string; how: string; priority: CoachingPriority }>;
  weeklyFocus?: { primaryGoal: string; successMetric: string };
}) {
  if (!actions?.length && !weeklyFocus) return null;

  return (
    <Panel title="תוכנית אימון לשבוע הקרוב">
      {weeklyFocus && (
        <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 p-5">
          <p className="text-sm font-medium text-primary">היעד המרכזי לשבוע</p>
          <p className="mt-1 text-zinc-100">{weeklyFocus.primaryGoal}</p>
          <p className="mt-2 text-sm text-zinc-400">
            איך תדע שהצלחת: {weeklyFocus.successMetric}
          </p>
        </div>
      )}

      {actions?.length ? (
        <ul className="space-y-3">
          {actions.map((a, i) => {
            const meta = PRIORITY_META[a.priority];
            return (
              <li key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-zinc-100">{a.action}</p>
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                </div>
                <p className="mt-2 text-sm text-zinc-400">למה: {a.why}</p>
                <p className="mt-1 text-sm text-zinc-400">איך: {a.how}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Panel>
  );
}
