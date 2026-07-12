import { Panel } from "./ui";
import { OBJECTION_SCORE_ICON, ICON_STROKE_WIDTH } from "./icons";
import type { ObjectionScore } from "@/types";

const SCORE_META: Record<ObjectionScore, { label: string; cls: string }> = {
  excellent: {
    label: "מצוין",
    cls: "bg-score-high/10 text-score-high ring-score-high/25",
  },
  good: {
    label: "טוב",
    cls: "bg-primary/10 text-primary ring-primary/25",
  },
  poor: {
    label: "חלש",
    cls: "bg-score-mid/10 text-score-mid ring-score-mid/25",
  },
  missed: {
    label: "פוספס",
    cls: "bg-score-low/10 text-score-low ring-score-low/25",
  },
};

/** How each objection was raised and handled, with a color-coded grade. */
export function ObjectionTracker({
  objections,
}: {
  objections: Array<{ objection: string; howHandled: string; score: ObjectionScore }>;
}) {
  return (
    <Panel title="מעקב התנגדויות">
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-right text-sm">
          <thead className="bg-zinc-950/40 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">מה הלקוח אמר</th>
              <th className="px-4 py-2.5 font-medium">איך טופל</th>
              <th className="px-4 py-2.5 font-medium">ציון</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {objections.map((o, i) => {
              const meta = SCORE_META[o.score];
              const Icon = OBJECTION_SCORE_ICON[o.score];
              return (
                <tr key={i} className="align-top">
                  <td className="px-4 py-3 text-zinc-200">{o.objection}</td>
                  <td className="px-4 py-3 text-zinc-400">{o.howHandled}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${meta.cls}`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE_WIDTH} />
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
