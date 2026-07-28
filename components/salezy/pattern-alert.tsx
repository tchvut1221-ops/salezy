import Link from "next/link";
import { ArrowLeft, Lightbulb, Radar } from "lucide-react";
import { Panel } from "./ui";
import { ICON_STROKE_WIDTH } from "./icons";
import { MIN_CALLS_FOR_PATTERN, type DashboardInsights } from "@/lib/patterns";

/**
 * The single highest-priority recurring pattern across the user's calls, with
 * the coaching move paired to it — the dashboard's read of what /patterns
 * computes in full.
 *
 * Only the top finding, deliberately: a dashboard widget that lists four
 * findings is just the patterns page in a smaller box. The link at the bottom
 * is also the fix for a D0 audit finding — until now /patterns was reachable
 * only from the header nav, with nothing in the dashboard's own body pointing
 * at it.
 *
 * Every branch below is a real state of the same gate the /patterns page uses
 * (3+ scorecard-bearing calls), not a placeholder: not enough calls yet,
 * enough calls but no pattern crossed its threshold (genuinely good news), or
 * a finding to act on.
 */
export function PatternAlert({
  insights,
  className,
}: {
  insights: DashboardInsights;
  /** Grid placement from the dashboard (e.g. "lg:col-span-2"). */
  className?: string;
}) {
  const remaining = Math.max(0, MIN_CALLS_FOR_PATTERN - insights.callCount);

  return (
    <Panel eyebrow="דפוסים" title="הדפוס הבולט" className={className}>
      {!insights.eligible ? (
        <p className="text-sm leading-relaxed text-zinc-500">
          זיהוי דפוסים דורש לפחות {MIN_CALLS_FOR_PATTERN} שיחות מנותחות עם כרטיס
          ביצועים. יש לך {insights.callCount} — עוד {remaining} ונתחיל לזהות מה
          חוזר על עצמו.
        </p>
      ) : !insights.topFinding ? (
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-400">
          <Radar
            className="mt-0.5 h-5 w-5 shrink-0 text-score-high"
            strokeWidth={ICON_STROKE_WIDTH}
            aria-hidden="true"
          />
          לא זוהה אף דפוס בעייתי חוזר על פני {insights.callCount} השיחות שנותחו.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-zinc-300">
            {insights.topFinding.message}
          </p>

          {insights.topCoaching && (
            <div className="mt-4 rounded-lg border border-insight/25 bg-insight/5 p-4">
              <p className="flex items-center gap-2 text-caption font-medium text-insight">
                <Lightbulb
                  className="h-4 w-4 shrink-0"
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden="true"
                />
                מה לעשות עם זה
              </p>
              <p className="mt-2 text-sm text-zinc-200">{insights.topCoaching.action}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                {insights.topCoaching.how}
              </p>
            </div>
          )}
        </>
      )}

      <Link
        href="/patterns"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg text-sm text-primary outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      >
        לכל הדפוסים
        {/* RTL: forward points left (DESIGN.md). */}
        <ArrowLeft className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      </Link>
    </Panel>
  );
}
