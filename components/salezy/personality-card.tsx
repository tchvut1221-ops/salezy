import { Panel, Pill, scoreColor, Meter } from "./ui";
import { Quote } from "./quote";
import { PERSONALITY_TYPE_META as TYPE_META } from "@/lib/disc-reference";
import { PERSONALITY_TYPE_ICON, ICON_STROKE_WIDTH } from "./icons";
import type { AnalysisResult, PersonalityType } from "@/types";

/**
 * Customer DISC personality. Upgraded from the old type+explanation card to
 * surface everything the pipeline now produces — secondary/blend type, the
 * two-axis read, confidence, the linguistic evidence behind the call, and the
 * per-type selling guidance. Every enriched field is guarded so a legacy
 * analysis (type+explanation only) still renders cleanly.
 */

const AXIS_LABEL = {
  assertiveness: { high: "אסרטיביות גבוהה", low: "אסרטיביות נמוכה" },
  responsiveness: { task: "ממוקד משימה", people: "ממוקד אנשים" },
} as const;

export function PersonalityCard({
  personality,
  hideSignals = false,
}: {
  personality: AnalysisResult["customerPersonality"];
  /** Skip the linguistic-evidence (signals) block. The 4-section analysis view
   *  surfaces the DISC quotes in the customer section's summary + "למה זיהיתי ככה?",
   *  so the full card in that section's details opts out to avoid showing them twice.
   *  Defaults to showing them, so every other caller is unaffected. */
  hideSignals?: boolean;
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
    indeterminate,
    discAxes,
  } = personality;

  const meta = TYPE_META[type];
  const Icon = PERSONALITY_TYPE_ICON[type];

  // Sign density too low to trust a type classification (lib/disc.ts). Show the
  // evidence that IS there (confidence bar + raw axis meters) without the
  // confident colored headline or per-type selling tips, which would be
  // guidance for a type we can't actually back with enough signal.
  if (indeterminate) {
    return (
      <Panel title="סוג אישיות הלקוח" eyebrow="פרופיל DISC">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-zinc-600" />
            <span className="text-lg font-semibold text-zinc-300">
              לא ניתן לקבוע בביטחון
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-400">{explanation}</p>
          {typeof confidence === "number" && <Confidence value={confidence} />}
          {discAxes && (
            <div className="grid gap-4 sm:grid-cols-2">
              <AxisMeters discAxes={discAxes} type={type} indeterminate />
              <DiscQuadrant discAxes={discAxes} type={type} indeterminate />
            </div>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="סוג אישיות הלקוח" eyebrow="פרופיל DISC">
      <div className="space-y-5">
        {/* Type headline + blend + confidence */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${meta.text}`} strokeWidth={ICON_STROKE_WIDTH} />
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

        {discAxes && (
          <div className="grid gap-4 sm:grid-cols-2">
            <AxisMeters discAxes={discAxes} type={type} />
            <DiscQuadrant discAxes={discAxes} type={type} />
          </div>
        )}

        <p className="text-sm leading-relaxed text-zinc-300">{explanation}</p>

        {/* Linguistic evidence */}
        {!hideSignals && signals && signals.length > 0 && (
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
                  <p className="text-zinc-200">
                    <Quote>{s.quote}</Quote>
                  </p>
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

function AxisMeters({
  discAxes,
  type,
  indeterminate = false,
}: {
  discAxes: NonNullable<AnalysisResult["customerPersonality"]["discAxes"]>;
  type: PersonalityType;
  /** Low-confidence read: show the raw evidence in neutral gray rather than
   *  the type's color, matching the indeterminate branch's "no confident
   *  colored headline" rule elsewhere in this card. */
  indeterminate?: boolean;
}) {
  const colorClass = indeterminate ? "bg-zinc-500" : TYPE_META[type].dot;
  return (
    <div className="space-y-3">
      <AxisMeter
        label="רשמי ↔ בלתי-רשמי"
        lowPoleLabel="בלתי-רשמי"
        highPoleLabel="רשמי"
        score={discAxes.formalInformal.score}
        signalCount={discAxes.formalInformal.signalCount}
        colorClass={colorClass}
      />
      <AxisMeter
        label="דומיננטי ↔ פאסיבי"
        lowPoleLabel="פאסיבי"
        highPoleLabel="דומיננטי"
        score={discAxes.dominantPassive.score}
        signalCount={discAxes.dominantPassive.signalCount}
        colorClass={colorClass}
      />
    </div>
  );
}

/**
 * A genuinely bipolar meter: score is 0-18 with 9 as a true neutral midpoint
 * (lib/disc.ts's axisScore()), but the old version rendered it as a
 * unipolar 0-100% fill from the start edge — so a perfectly neutral 9/18
 * call visually read as "about half of something", not "dead center,
 * neither pole". This version anchors the fill at the center and grows it
 * toward whichever pole the score actually favors.
 */
function AxisMeter({
  label,
  lowPoleLabel,
  highPoleLabel,
  score,
  signalCount,
  colorClass,
}: {
  label: string;
  lowPoleLabel: string;
  highPoleLabel: string;
  score: number;
  signalCount: number;
  colorClass: string;
}) {
  const clamped = Math.max(0, Math.min(18, score));
  const frac = (clamped - 9) / 9; // -1 (fully low pole) .. 0 (neutral) .. 1 (fully high pole)
  const widthPct = Math.abs(frac) * 50;
  const startPct = frac >= 0 ? 50 : 50 - widthPct;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span dir="ltr" className="font-mono tabular-nums">
          {score}/18 · {signalCount} סימנים
        </span>
      </div>
      <div
        dir="ltr"
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
      >
        <div
          className={`absolute inset-y-0 rounded-full ${colorClass}`}
          style={{ insetInlineStart: `${startPct}%`, width: `${widthPct}%` }}
        />
        {/* Center marker — the true neutral point, not the fill's own edge. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-px -translate-x-1/2 bg-zinc-500"
          style={{ insetInlineStart: "50%" }}
        />
      </div>
      <div dir="ltr" className="mt-1 flex justify-between text-[11px] text-zinc-600">
        <span>{lowPoleLabel}</span>
        <span>{highPoleLabel}</span>
      </div>
    </div>
  );
}

const QUADRANT_TINT: Record<PersonalityType, string> = {
  Driver: "bg-disc-d/5",
  Expressive: "bg-disc-i/5",
  Amiable: "bg-disc-s/5",
  Analytical: "bg-disc-c/5",
};

/**
 * The 2x2 map the two axis scores actually describe. Deliberately NOT a
 * 4-spoke radar chart — the DISC engine (lib/disc.ts) measures exactly two
 * continuous axes (formalInformal, dominantPassive), not four independent
 * D/I/S/C magnitudes, so a radar would have to fabricate two of its four
 * spokes. This plots the real two-number position instead. Quadrant
 * placement is lib/disc-reference.ts's QUADRANT_MAP, restated visually:
 * top-left=Driver (task+high), top-right=Expressive (people+high),
 * bottom-left=Analytical (task+low), bottom-right=Amiable (people+low).
 */
function DiscQuadrant({
  discAxes,
  type,
  indeterminate = false,
}: {
  discAxes: NonNullable<AnalysisResult["customerPersonality"]["discAxes"]>;
  type: PersonalityType;
  indeterminate?: boolean;
}) {
  // x: formalInformal score, high(18)=task -> start(left in this LTR box), low(0)=people -> end.
  // y: dominantPassive score, high(18)=dominant -> top, low(0)=passive -> bottom.
  const xPct = 100 - (discAxes.formalInformal.score / 18) * 100;
  const yPct = 100 - (discAxes.dominantPassive.score / 18) * 100;
  const dotColor = indeterminate ? "bg-zinc-400" : TYPE_META[type].dot;
  const positionLabel = indeterminate
    ? `מיקום בפרופיל: לא ניתן לקבוע בביטחון, ${discAxes.formalInformal.score}/18 בציר משימה-אנשים, ${discAxes.dominantPassive.score}/18 בציר דומיננטיות-פאסיביות`
    : `מיקום בפרופיל: ${TYPE_META[type].he}, ${discAxes.formalInformal.score}/18 בציר משימה-אנשים, ${discAxes.dominantPassive.score}/18 בציר דומיננטיות-פאסיביות`;

  return (
    <div>
      {/* Container is the positioning context for the dot below: a 2-col grid
          of aspect-square cells renders as an overall square, so the dot's
          percentage-based inset lines up with the visual grid exactly. */}
      <div
        dir="ltr"
        role="img"
        aria-label={positionLabel}
        className="relative grid grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg bg-zinc-800"
      >
        {(["Driver", "Expressive", "Analytical", "Amiable"] as const).map((cellType) => (
          <div key={cellType} className={`aspect-square ${QUADRANT_TINT[cellType]}`} />
        ))}
        <span
          aria-hidden="true"
          className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-950 ${dotColor}`}
          style={{ insetInlineStart: `${xPct}%`, top: `${yPct}%` }}
        />
      </div>
      <div dir="ltr" className="mt-1.5 flex justify-between text-[11px] text-zinc-600">
        <span>ממוקד-משימה</span>
        <span>ממוקד-אנשים</span>
      </div>
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const c = scoreColor(pct);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-400">רמת ביטחון בזיהוי</span>
        <span dir="ltr" className={`font-mono tabular-nums ${c.text}`}>
          {pct}%
        </span>
      </div>
      <Meter value={pct} size="sm" fillClassName={`h-full rounded-full ${c.bar}`} />
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
  const dot = tone === "positive" ? "bg-score-high" : "bg-score-low";
  const head = tone === "positive" ? "text-score-high" : "text-score-low";
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
