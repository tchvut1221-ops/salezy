import { Panel } from "./ui";
import type { NextStepPriority } from "@/types";

const PRIORITY_META: Record<
  NextStepPriority,
  { label: string; dot: string; cls: string }
> = {
  urgent: {
    label: "דחוף",
    dot: "bg-red-500",
    cls: "bg-red-500/10 text-red-300 ring-red-500/25",
  },
  soon: {
    label: "בקרוב",
    dot: "bg-amber-500",
    cls: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  },
  "when-possible": {
    label: "כשאפשר",
    dot: "bg-emerald-500",
    cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
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
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${meta.cls}`}
                  >
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
