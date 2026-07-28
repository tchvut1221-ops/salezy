import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Panel } from "./ui";
import { ICON_STROKE_WIDTH } from "./icons";

export interface ChecklistStep {
  label: string;
  done: boolean;
  /** Where to send the user to complete this step, when it isn't done yet. */
  href?: string;
}

/**
 * D6 onboarding checklist (רעיון 10) — 5 real, cheaply-derivable milestones
 * (upload / first analysis / first practice / 3+ scored calls, plus the
 * account-exists step so a brand-new user starts at 1/5 rather than 0/5).
 * Stops rendering once every step is done — this is meant to build early
 * momentum, not become a permanent dashboard fixture for established users.
 */
export function OnboardingChecklist({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Panel eyebrow={`${doneCount}/${steps.length} הושלמו`} title="צעדים ראשונים">
      <ul className="space-y-1">
        {steps.map((step, i) => {
          const row = (
            <span className="flex items-center gap-2.5">
              {step.done ? (
                <Check
                  className="h-4 w-4 shrink-0 text-score-high"
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="h-4 w-4 shrink-0 text-zinc-600"
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden="true"
                />
              )}
              <span className={step.done ? "text-zinc-500 line-through" : "text-zinc-200"}>
                {step.label}
              </span>
            </span>
          );
          return (
            <li key={i}>
              {!step.done && step.href ? (
                <Link
                  href={step.href}
                  className="flex rounded-lg px-1 py-1.5 outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row}
                </Link>
              ) : (
                <div className="px-1 py-1.5">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
