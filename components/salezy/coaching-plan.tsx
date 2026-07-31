"use client";

import { useEffect, useState } from "react";
import { Panel, Pill } from "./ui";
import { getCoachingCompletions, toggleCoachingCompletion } from "@/app/actions";
import type { CoachingPriority } from "@/types";

const PRIORITY_META: Record<
  CoachingPriority,
  { label: string; tone: "negative" | "warn" | "neutral" }
> = {
  high: { label: "עדיפות גבוהה", tone: "negative" },
  medium: { label: "עדיפות בינונית", tone: "warn" },
  low: { label: "עדיפות נמוכה", tone: "neutral" },
};

/**
 * `completed` is fetched client-side on mount (same "client-only state
 * hydrated post-mount" pattern as accessibility-widget.tsx/app-sidebar.tsx —
 * this component's parents are already Client Components with no
 * server-fetched completion data to pass down) rather than blocking initial
 * render. Toggling is optimistic: this is a decorative checklist no other
 * part of the page depends on, so there's no meaningful state to roll back
 * to on a failed write — getCoachingCompletions/toggleCoachingCompletion
 * (app/actions.ts) already degrade silently server-side (logged, not
 * thrown) if migration 0016 hasn't been applied yet, so a checkbox click
 * before that migration runs just doesn't persist, with no error surfaced.
 */
export function CoachingPlan({
  analysisId,
  actions,
}: {
  analysisId: string;
  actions?: Array<{ action: string; why: string; how: string; priority: CoachingPriority }>;
}) {
  const [completed, setCompleted] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getCoachingCompletions(analysisId).then((indices) => {
      if (!cancelled) setCompleted(indices);
    });
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  if (!actions?.length) return null;

  function toggle(index: number, actionText: string) {
    const wasCompleted = completed.has(index);
    setCompleted((prev) => {
      const next = new Set(prev);
      if (wasCompleted) next.delete(index);
      else next.add(index);
      return next;
    });
    void toggleCoachingCompletion(analysisId, index, actionText, !wasCompleted);
  }

  return (
    <Panel title="תוכנית אימון לשבוע הקרוב">
      <ul className="space-y-3">
        {actions.map((a, i) => {
          const meta = PRIORITY_META[a.priority];
          const isDone = completed.has(i);
          return (
            <li key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggle(i, a.action)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-interactive bg-elevated text-primary focus:ring-2 focus:ring-ring"
                  />
                  <p className={`font-medium text-zinc-100 ${isDone ? "text-zinc-500 line-through" : ""}`}>
                    {a.action}
                  </p>
                </label>
                <Pill tone={meta.tone}>{meta.label}</Pill>
              </div>
              <p className="mt-2 text-sm text-zinc-400">למה: {a.why}</p>
              <p className="mt-1 text-sm text-zinc-400">איך: {a.how}</p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
