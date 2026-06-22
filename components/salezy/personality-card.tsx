import { Panel, Pill, scoreColor } from "./ui";
import type { AnalysisResult, PersonalityType } from "@/types";

/**
 * Customer DISC personality. Upgraded from the old type+explanation card to
 * surface everything the pipeline now produces — secondary/blend type, the
 * two-axis read, confidence, the linguistic evidence behind the call, and the
 * per-type selling guidance. Every enriched field is guarded so a legacy
 * analysis (type+explanation only) still renders cleanly.
 */

// Color overlay from the popular 4-type framework Israeli reps know: Red /
// Yellow / Green / Blue. Derived deterministically from `type` — no schema field.
const TYPE_META: Record<
  PersonalityType,
  { he: string; tagline: string; colorName: string; dot: string; text: string }
> = {
  Driver: {
    he: "משימתי",
    tagline: "תוצאות ושליטה",
    colorName: "אדום",
    dot: "bg-[#FF4D4D]",
    text: "text-[#FF4D4D]",
  },
  Expressive: {
    he: "מבטא",
    tagline: "השפעה ורגש",
    colorName: "צהוב",
    dot: "bg-[#FFD400]",
    text: "text-[#FFD400]",
  },
  Amiable: {
    he: "תומך",
    tagline: "יחסים ויציבות",
    colorName: "ירוק",
    dot: "bg-[#00C48C]",
    text: "text-[#00C48C]",
  },
  Analytical: {
    he: "אנליטי",
    tagline: "דיוק ונתונים",
    colorName: "כחול",
    dot: "bg-[#4D7EFF]",
    text: "text-[#4D7EFF]",
  },
};

const AXIS_LABEL = {
  assertiveness: { high: "אסרטיביות גבוהה", low: "אסרטיביות נמוכה" },
  responsiveness: { task: "ממוקד משימה", people: "ממוקד אנשים" },
} as const;

export function PersonalityCard({
  personality,
}: {
  personality: AnalysisResult["customerPersonality"];
}) {
  const {
    type,
    secondaryType,
    explanation,
    confidence,
    axes,
    signals,
    howToSellToThisType,
    redFlags,
  } = personality;

  const meta = TYPE_META[type];

  return (
    <Panel title="סוג אישיות הלקוח" eyebrow="פרופיל DISC">
      <div className="space-y-5">
        {/* Type headline + blend + confidence */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-full ${meta.dot}`} />
            <span className={`text-2xl font-bold ${meta.text}`}>{meta.he}</span>
          </span>
          <span className="text-sm text-zinc-500">
            {meta.colorName} · {meta.tagline} · {type}
          </span>
          {secondaryType && secondaryType !== type && (
            <Pill tone="info">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${TYPE_META[secondaryType].dot}`}
                />
                נטייה משנית: {TYPE_META[secondaryType].he}
              </span>
            </Pill>
          )}
        </div>

        {typeof confidence === "number" && (
          <Confidence value={confidence} />
        )}

        {/* Two-axis read */}
        {axes && (
          <div className="flex flex-wrap gap-2">
            <Pill tone="neutral">{AXIS_LABEL.assertiveness[axes.assertiveness]}</Pill>
            <Pill tone="neutral">{AXIS_LABEL.responsiveness[axes.responsiveness]}</Pill>
          </div>
        )}

        <p className="text-sm leading-relaxed text-zinc-300">{explanation}</p>

        {/* Linguistic evidence */}
        {signals && signals.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-400">
              סימנים בתמלול
            </p>
            <ul className="space-y-2.5">
              {signals.map((s, i) => (
                <li
                  key={i}
                  className="border-s-2 border-zinc-700 ps-3 text-sm"
                >
                  <p className="text-zinc-200">“{s.quote}”</p>
                  <p className="mt-0.5 text-zinc-500">{s.interpretation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {howToSellToThisType && howToSellToThisType.length > 0 && (
          <TipList
            label="איך למכור לאישיות הזו"
            items={howToSellToThisType}
            tone="positive"
          />
        )}

        {redFlags && redFlags.length > 0 && (
          <TipList label="ממה להימנע" items={redFlags} tone="negative" />
        )}
      </div>
    </Panel>
  );
}

function Confidence({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const c = scoreColor(pct);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-400">רמת ביטחון בזיהוי</span>
        <span className={c.text}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TipList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const dot = tone === "positive" ? "bg-[#00D4A0]" : "bg-[#FF4D6A]";
  const head = tone === "positive" ? "text-[#00D4A0]" : "text-[#FF4D6A]";
  return (
    <div>
      <p className={`mb-2 text-sm font-medium ${head}`}>{label}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-zinc-300">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
