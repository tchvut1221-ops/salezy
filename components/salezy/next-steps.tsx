import { Panel } from "./ui";
import { NEXT_STEP_PRIORITY_ICON, ICON_STROKE_WIDTH } from "./icons";
import type { NextStepPriority } from "@/types";

const PRIORITY_META: Record<
  NextStepPriority,
  { label: string; dot: string; cls: string }
> = {
  urgent: {
    label: "דחוף",
    dot: "bg-score-low",
    cls: "bg-score-low/10 text-score-low ring-score-low/25",
  },
  soon: {
    label: "בקרוב",
    dot: "bg-score-mid",
    cls: "bg-score-mid/10 text-score-mid ring-score-mid/25",
  },
  "when-possible": {
    label: "כשאפשר",
    dot: "bg-score-high",
    cls: "bg-score-high/10 text-score-high ring-score-high/25",
  },
};

// Same explicit-rank-map + non-mutating-sort convention as analysis-sections.tsx's
// PRIORITY_RANK for coachingActions — the LLM's own emission order isn't a
// reliable urgency ordering.
const PRIORITY_RANK: Record<NextStepPriority, number> = {
  urgent: 0,
  soon: 1,
  "when-possible": 2,
};

/** Ordered action list — what to do next, ranked by urgency. */
export function NextSteps({
  steps,
}: {
  steps: Array<{ action: string; priority: NextStepPriority; reasoning: string }>;
}) {
  const sortedSteps = [...steps].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  );
  return (
    <Panel title="הצעדים הבאים">
      <ul className="space-y-3">
        {sortedSteps.map((s, i) => {
          const meta = PRIORITY_META[s.priority];
          const Icon = NEXT_STEP_PRIORITY_ICON[s.priority];
          return (
            // Second-level block: raised surface, no border of its own.
            <li key={i} className="flex gap-3 rounded-lg bg-elevated p-4">
              <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium leading-relaxed text-zinc-100">{s.action}</p>
                  <span
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-caption font-medium ring-1 ring-inset ${meta.cls}`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
                    {meta.label}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.reasoning}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
