"use client";

import { Panel } from "./ui";
import { Quote } from "./quote";
import { MOMENT_ICON, ICON_STROKE_WIDTH } from "./icons";
import { scrollToTranscriptQuote } from "./scroll-to-quote";
import type { MomentType } from "@/types";

const MOMENT_META: Record<
  MomentType,
  { label: string; dot: string; quoteText: string; ring: string }
> = {
  buying_signal: {
    label: "אות רכישה",
    dot: "bg-score-high",
    quoteText: "text-score-high",
    ring: "ring-score-high/25",
  },
  objection: {
    label: "התנגדות",
    dot: "bg-score-low",
    quoteText: "text-score-low",
    ring: "ring-score-low/25",
  },
  pain_point: {
    label: "נקודת כאב",
    dot: "bg-score-mid",
    quoteText: "text-score-mid",
    ring: "ring-score-mid/25",
  },
  breakthrough: {
    label: "פריצת דרך",
    dot: "bg-primary",
    quoteText: "text-primary",
    ring: "ring-primary/25",
  },
};

/**
 * A chronological timeline of quotable moments from the call. Each entry keeps the
 * customer's own words front and center, color-coded by what kind of moment it was.
 */
export function KeyMoments({
  moments,
}: {
  moments: Array<{ quote: string; type: MomentType; significance: string }>;
}) {
  return (
    <Panel title="רגעי מפתח">
      <ol className="relative space-y-6 border-e-2 border-zinc-800 pe-6">
        {moments.map((m, i) => {
          const meta = MOMENT_META[m.type];
          const Icon = MOMENT_ICON[m.type];
          return (
            <li key={i} className="relative">
              <span
                className={`absolute top-1.5 -end-[29px] h-3 w-3 rounded-full ${meta.dot} ring-4 ring-zinc-900`}
              />
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${meta.ring} text-zinc-300`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
                {meta.label}
              </span>
              <p className={`mt-2 text-base leading-relaxed ${meta.quoteText}`}>
                <button
                  type="button"
                  onClick={() => scrollToTranscriptQuote(`moment-${i}`)}
                  title="קפיצה למיקום בתמלול"
                  className="text-start underline-offset-4 hover:underline focus-visible:underline"
                >
                  <Quote>{m.quote}</Quote>
                </button>
              </p>
              <p className="mt-1 text-sm text-zinc-400">{m.significance}</p>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
