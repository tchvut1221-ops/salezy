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

/** Ordered action list — what to do next, ranked by urgency. */
export function NextSteps({
  steps,
}: {
  steps: Array<{ action: string; priority: NextStepPriority; reasoning: string }>;
}) {
  return (
    <Panel title="הצעדים הבאים">
      <ul className="space-y-3">
        {steps.map((s, i) => {
          const meta = PRIORITY_META[s.priority];
          const Icon = NEXT_STEP_PRIORITY_ICON[s.priority];
          return (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
            >
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-zinc-100">{s.action}</p>
                  <span
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${meta.cls}`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
                    {meta.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{s.reasoning}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
