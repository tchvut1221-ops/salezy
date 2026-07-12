import { Panel } from "./ui";

/**
 * Shimmering placeholders shaped like the real Stage B result cards
 * (ExecutiveSummary / ScoreGauge / DealIntelligence / ObjectionTracker /
 * KeyMoments / NextSteps), shown while an analysis is still processing. Gives
 * the user a preview of what's coming instead of a generic spinner.
 */

const shimmer = "animate-pulse rounded-md bg-zinc-800";

export function ResultSkeleton() {
  return (
    <div className="mt-8 space-y-5" aria-hidden="true">
      <ExecutiveSummarySkeleton />
      <ScoreGaugeSkeleton />
      <DealIntelligenceSkeleton />
      <ObjectionTrackerSkeleton />
      <KeyMomentsSkeleton />
      <NextStepsSkeleton />
      <ScorecardSkeleton />
      <CoachingPlanSkeleton />
    </div>
  );
}

function ExecutiveSummarySkeleton() {
  return (
    <Panel>
      <div className={`h-3 w-24 ${shimmer}`} />
      <div className={`mt-3 h-5 w-full ${shimmer}`} />
      <div className={`mt-2 h-5 w-4/5 ${shimmer}`} />
      <div className="mt-4 flex items-center gap-3 border-t border-zinc-800 pt-4">
        <div className={`h-3 w-20 ${shimmer}`} />
        <div className={`h-3 w-32 ${shimmer}`} />
        <div className={`ms-auto h-6 w-24 rounded-full ${shimmer}`} />
      </div>
    </Panel>
  );
}

function ScoreGaugeSkeleton() {
  return (
    <Panel title="ציון השיחה">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        <div className="relative shrink-0" dir="ltr">
          <svg viewBox="0 0 200 118" className="w-52" aria-hidden="true">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#2A2A3D"
              strokeWidth="14"
              strokeLinecap="round"
              className="animate-pulse"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <div className={`h-8 w-12 ${shimmer}`} />
          </div>
        </div>
        <div className="w-full space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between">
                <div className={`h-3 w-24 ${shimmer}`} />
                <div className={`h-3 w-6 ${shimmer}`} />
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function DealIntelligenceSkeleton() {
  return (
    <Panel title="מודיעין עסקה">
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`h-3 w-3 rounded-full ${shimmer}`} />
              <div className={`h-2.5 w-10 ${shimmer}`} />
            </div>
            {i < 4 && <div className="mx-1 h-px flex-1 bg-zinc-800" />}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ObjectionTrackerSkeleton() {
  return (
    <Panel title="מעקב התנגדויות">
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="divide-y divide-zinc-800">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className={`h-4 flex-[2] ${shimmer}`} />
              <div className={`h-4 flex-[2] ${shimmer}`} />
              <div className={`h-5 w-14 rounded-full ${shimmer}`} />
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function KeyMomentsSkeleton() {
  return (
    <Panel title="רגעי מפתח">
      <ol className="relative space-y-6 border-e-2 border-zinc-800 pe-6">
        {[0, 1, 2].map((i) => (
          <li key={i} className="relative">
            <span className="absolute top-1.5 -end-[29px] h-3 w-3 rounded-full bg-zinc-700 ring-4 ring-zinc-900" />
            <div className={`h-5 w-20 rounded-full ${shimmer}`} />
            <div className={`mt-2 h-4 w-full ${shimmer}`} />
            <div className={`mt-1 h-3 w-2/3 ${shimmer}`} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function NextStepsSkeleton() {
  return (
    <Panel title="הצעדים הבאים">
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
          >
            <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${shimmer}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className={`h-4 w-1/2 ${shimmer}`} />
                <div className={`h-5 w-14 rounded-full ${shimmer}`} />
              </div>
              <div className={`mt-2 h-3 w-full ${shimmer}`} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ScorecardSkeleton() {
  return (
    <Panel title="ניתוח ביצועים — איש המכירות">
      <div className="mb-6 flex justify-center">
        <div className={`h-12 w-24 ${shimmer}`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className={`h-4 w-24 ${shimmer}`} />
            <div className="mt-3 flex gap-1.5">
              {[0, 1, 2, 3, 4].map((d) => (
                <div key={d} className={`h-2.5 w-2.5 rounded-full ${shimmer}`} />
              ))}
            </div>
            <div className={`mt-3 h-4 w-full ${shimmer}`} />
            <div className={`mt-3 h-10 w-full rounded-lg ${shimmer}`} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CoachingPlanSkeleton() {
  return (
    <Panel title="תוכנית אימון לשבוע הקרוב">
      <div className={`mb-5 h-20 w-full rounded-xl ${shimmer}`} />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className={`h-4 w-1/2 ${shimmer}`} />
            <div className={`mt-2 h-3 w-full ${shimmer}`} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
