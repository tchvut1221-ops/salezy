import { Panel, Pill } from "./ui";
import { SIGNAL_DIRECTION_ICON, ICON_STROKE_WIDTH } from "./icons";
import type { DealStage } from "@/types";

const STAGES: { key: Exclude<DealStage, "unknown">; label: string }[] = [
  { key: "discovery", label: "גילוי" },
  { key: "demo", label: "הדגמה" },
  { key: "objection", label: "התנגדות" },
  { key: "negotiation", label: "משא ומתן" },
  { key: "close", label: "סגירה" },
];

/**
 * Deal momentum: where the call landed in the pipeline (a real sequence, so a
 * stepper is the honest device) plus the buying signals and competitors heard.
 */
export function DealIntelligence({
  dealStage,
  buyingSignals,
  competitors,
}: {
  dealStage?: DealStage;
  buyingSignals?: { positive: string[]; negative: string[] };
  competitors?: string[];
}) {
  const idx =
    dealStage && dealStage !== "unknown"
      ? STAGES.findIndex((s) => s.key === dealStage)
      : -1;
  const positive = buyingSignals?.positive ?? [];
  const negative = buyingSignals?.negative ?? [];
  const showSignals = positive.length > 0 || negative.length > 0;

  return (
    <Panel title="מודיעין עסקה">
      <div className="space-y-6">
        {idx >= 0 && (
          <div className="flex items-center">
            {STAGES.map((s, i) => {
              const reached = i <= idx;
              const current = i === idx;
              return (
                <div key={s.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        current
                          ? "bg-primary ring-4 ring-primary/20"
                          : reached
                            ? "bg-primary"
                            : "bg-zinc-700"
                      }`}
                    />
                    <span
                      className={`whitespace-nowrap text-xs ${
                        reached ? "text-primary" : "text-zinc-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div
                      className={`mx-1 h-px flex-1 ${
                        i < idx ? "bg-primary/50" : "bg-zinc-800"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showSignals && (
          <div className="grid gap-5 sm:grid-cols-2">
            {positive.length > 0 && (
              <SignalList
                label="אותות חיוביים"
                items={positive}
                tone="positive"
              />
            )}
            {negative.length > 0 && (
              <SignalList
                label="אותות שליליים"
                items={negative}
                tone="negative"
              />
            )}
          </div>
        )}

        {competitors && competitors.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-400">
              מתחרים שהוזכרו
            </p>
            <div className="flex flex-wrap gap-2">
              {competitors.map((name, i) => (
                <Pill key={i} tone="info">
                  {name}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function SignalList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const head = tone === "positive" ? "text-score-high" : "text-score-low";
  const Icon = SIGNAL_DIRECTION_ICON[tone];
  return (
    <div>
      <p className={`mb-2 flex items-center gap-1.5 text-sm font-medium ${head}`}>
        <Icon className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} />
        {label}
      </p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-zinc-300">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "positive" ? "bg-score-high" : "bg-score-low"}`} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
