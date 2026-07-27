import { Meter, Panel } from "./ui";
import { PERSONALITY_TYPE_META } from "@/lib/disc-reference";
import type { PersonalityShare } from "@/lib/analytics";

/**
 * Which customer types this user actually meets, as a share of their scored
 * calls. Answers a question the per-call personality card can't: "am I always
 * selling to the same kind of person, and is my average dragged down by one
 * type I keep mishandling?"
 *
 * Free data-wise — `scores.personalityType` is already part of the flat
 * snapshot the dashboard fetches for the chart (see
 * computePersonalityDistribution), so this widget adds no query.
 *
 * Bars use Meter, which is documented for exactly this case: a plain in-flow
 * 0-100 fill. In RTL the fill grows from the start (right) edge with no
 * special handling, which is why Meter's own docs rule out the anchored /
 * bidirectional bars elsewhere in the app but allow this one.
 */
export function DiscDistribution({
  shares,
  className,
}: {
  shares: PersonalityShare[];
  /** Grid placement from the dashboard (e.g. "lg:col-span-2"). */
  className?: string;
}) {
  return (
    <Panel eyebrow="לקוחות" title="טיפוסי אישיות" className={className}>
      {shares.length === 0 ? (
        <p className="text-sm leading-relaxed text-zinc-500">
          עדיין לא זוהה טיפוס אישיות באף שיחה. הטיפוס מזוהה אוטומטית בכל שיחה
          מנותחת — הפילוח יופיע כאן מהשיחה הבאה.
        </p>
      ) : (
        <ul className="space-y-4">
          {shares.map((share) => {
            const meta = PERSONALITY_TYPE_META[share.type];
            return (
              <li key={share.type}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-300">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{meta.he}</span>
                  </span>
                  <span
                    dir="ltr"
                    className="shrink-0 font-mono text-caption tabular-nums text-zinc-500"
                  >
                    {share.count} · {share.percentage}%
                  </span>
                </div>
                <Meter
                  value={share.percentage}
                  size="sm"
                  trackClassName="mt-2"
                  fillClassName={`h-full rounded-full ${meta.dot}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
