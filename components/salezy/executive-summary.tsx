import { Pill } from "./ui";

const ACHIEVED = {
  yes: { label: "המטרה הושגה", tone: "positive" },
  partial: { label: "הושגה חלקית", tone: "warn" },
  no: { label: "המטרה לא הושגה", tone: "negative" },
} as const;

/**
 * The thesis of the page — the narrative verdict on the call. The numeric score
 * lives in the gauge below; this card answers "what happened, and did it work".
 */
export function ExecutiveSummary({
  summary,
  callObjective,
  achieved,
}: {
  summary: string;
  callObjective?: string;
  achieved?: "yes" | "partial" | "no";
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        סיכום השיחה
      </p>
      <p className="mt-2 text-lg leading-relaxed text-zinc-100">{summary}</p>

      {(callObjective || achieved) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3 border-t border-zinc-800 pt-4 text-sm">
          {callObjective && (
            <>
              <span className="text-zinc-500">מטרת השיחה:</span>
              <span className="text-zinc-300">{callObjective}</span>
            </>
          )}
          {achieved && (
            <span className="ms-auto">
              <Pill tone={ACHIEVED[achieved].tone}>{ACHIEVED[achieved].label}</Pill>
            </span>
          )}
        </div>
      )}
    </section>
  );
}
