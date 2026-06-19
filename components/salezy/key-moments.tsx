import { Panel } from "./ui";
import type { MomentType } from "@/types";

const MOMENT_META: Record<
  MomentType,
  { label: string; dot: string; quoteText: string; ring: string }
> = {
  buying_signal: {
    label: "אות רכישה",
    dot: "bg-emerald-500",
    quoteText: "text-emerald-300",
    ring: "ring-emerald-500/25",
  },
  objection: {
    label: "התנגדות",
    dot: "bg-red-500",
    quoteText: "text-red-300",
    ring: "ring-red-500/25",
  },
  pain_point: {
    label: "נקודת כאב",
    dot: "bg-amber-500",
    quoteText: "text-amber-300",
    ring: "ring-amber-500/25",
  },
  breakthrough: {
    label: "פריצת דרך",
    dot: "bg-sky-500",
    quoteText: "text-sky-300",
    ring: "ring-sky-500/25",
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
          return (
            <li key={i} className="relative">
              <span
                className={`absolute top-1.5 -end-[29px] h-3 w-3 rounded-full ${meta.dot} ring-4 ring-zinc-900`}
              />
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${meta.ring} text-zinc-300`}
              >
                {meta.label}
              </span>
              <p className={`mt-2 text-base leading-relaxed ${meta.quoteText}`}>
                &rdquo;{m.quote}&ldquo;
              </p>
              <p className="mt-1 text-sm text-zinc-400">{m.significance}</p>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
