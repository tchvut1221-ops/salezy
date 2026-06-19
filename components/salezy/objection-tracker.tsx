import { Panel } from "./ui";
import type { ObjectionScore } from "@/types";

const SCORE_META: Record<ObjectionScore, { label: string; cls: string }> = {
  excellent: {
    label: "מצוין",
    cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  },
  good: {
    label: "טוב",
    cls: "bg-teal-500/10 text-teal-300 ring-teal-500/25",
  },
  poor: {
    label: "חלש",
    cls: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  },
  missed: {
    label: "פוספס",
    cls: "bg-red-500/10 text-red-300 ring-red-500/25",
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
          <thead className="bg-zinc-950/40 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">מה הלקוח אמר</th>
              <th className="px-4 py-2.5 font-medium">איך טופל</th>
              <th className="px-4 py-2.5 font-medium">ציון</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {objections.map((o, i) => {
              const meta = SCORE_META[o.score];
              return (
                <tr key={i} className="align-top">
                  <td className="px-4 py-3 text-zinc-200">{o.objection}</td>
                  <td className="px-4 py-3 text-zinc-400">{o.howHandled}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${meta.cls}`}
                    >
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
