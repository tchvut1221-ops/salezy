import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Panel, Pill } from "./ui";
import { ICON_STROKE_WIDTH } from "./icons";
import type { DashboardInsights } from "@/lib/patterns";
import type { CoachingPriority } from "@/types";

/**
 * Same labels/tones as the analysis page's CoachingPlan. Redeclared rather
 * than imported because coaching-plan.tsx belongs to the analysis-detail
 * surface, which a later milestone (D3/D4) reworks — importing from it would
 * couple this widget to a file that's about to move.
 */
const PRIORITY_META: Record<
  CoachingPriority,
  { label: string; tone: "negative" | "warn" | "neutral" }
> = {
  high: { label: "עדיפות גבוהה", tone: "negative" },
  medium: { label: "עדיפות בינונית", tone: "warn" },
  low: { label: "עדיפות נמוכה", tone: "neutral" },
};

const MAX_ACTIONS = 3;

/**
 * The open coaching actions from the most recent call that produced any,
 * highest priority first, linking back to the call they came from.
 *
 * Scope note: this is a *queue view*, not a task manager — there is no
 * done/dismissed state, because tracking completion would need a new column
 * on `analyses` (or a new table), and this milestone is UI-only over data that
 * already exists in the result JSONB. Aggregating unfinished actions across
 * ALL calls without that state would just replay old advice the user may have
 * already acted on, which is worse than showing the latest call's plan
 * honestly.
 */
export function CoachingQueue({
  latest,
  className,
}: {
  latest: DashboardInsights["latestCoaching"];
  /** Grid placement from the dashboard (e.g. "lg:col-span-3"). */
  className?: string;
}) {
  const actions = latest?.actions.slice(0, MAX_ACTIONS) ?? [];

  return (
    <Panel eyebrow="אימון" title="מה לתרגל עכשיו" className={className}>
      {actions.length === 0 || !latest ? (
        <p className="text-sm leading-relaxed text-zinc-500">
          המלצות האימון נוצרות מתוך ניתוח השיחה. אחרי הניתוח הבא הן יופיעו כאן,
          לפי סדר עדיפות.
        </p>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action, i) => {
              const meta = PRIORITY_META[action.priority] ?? PRIORITY_META.low;
              return (
                <li
                  key={`${action.action}-${i}`}
                  className="rounded-lg border border-zinc-800 bg-elevated p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium text-zinc-100">
                      {action.action}
                    </p>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {action.how}
                  </p>
                </li>
              );
            })}
          </ul>

          <Link
            href={`/analysis/${latest.analysisId}`}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg text-sm text-primary outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            לשיחה שממנה זה נובע
            {/* RTL: forward points left (DESIGN.md). */}
            <ArrowLeft
              className="h-4 w-4"
              strokeWidth={ICON_STROKE_WIDTH}
              aria-hidden="true"
            />
          </Link>
        </>
      )}
    </Panel>
  );
}
