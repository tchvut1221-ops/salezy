import { Panel, Pill, scorecardScoreColor } from "./ui";
import { ScoreGauge } from "./score-gauge";
import { PERSONALITY_TYPE_META } from "@/lib/disc-reference";
import type { ScorecardCategoryKey } from "@/types";

/**
 * Fictional call — never a real user's data. This is the landing page's
 * signature visual: instead of a hero + 3-card-grid + vague "trust us" copy
 * (the classic AI-template shape this rebuild replaces), show the actual
 * product surface. Reuses the real ScoreGauge component so the count-up
 * animation and score-band colors are identical to what a real result
 * looks like — everything below it (scorecard dots, DISC pill) mirrors the
 * live components' visual language without importing their full data shape.
 */
const DEMO_SCORE = 82;
const DEMO_SUBSCORES = {
  needsDiscovery: 78,
  objectionHandling: 85,
  listeningRatio: 74,
  closing: 88,
};

const DEMO_CATEGORIES: { key: ScorecardCategoryKey; label: string; score: number }[] = [
  { key: "opening", label: "פתיחה", score: 4 },
  { key: "discovery", label: "גילוי צרכים", score: 5 },
  { key: "pitch", label: "הצגת פתרון", score: 4 },
  { key: "objectionHandling", label: "טיפול בהתנגדויות", score: 3 },
  { key: "closing", label: "סגירה", score: 5 },
];

export function LandingDemo() {
  const disc = PERSONALITY_TYPE_META.Driver;
  return (
    <div className="relative">
      <span className="absolute -top-3 start-4 z-10 rounded-full bg-accent-blue-deep px-3 py-1 text-xs font-medium text-primary-foreground">
        דוגמה
      </span>
      <div className="space-y-4">
        <ScoreGauge overall={DEMO_SCORE} scores={DEMO_SUBSCORES} />

        <Panel eyebrow="פרופיל DISC" title="סוג אישיות הלקוח">
          <div className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-full ${disc.dot}`} />
            <span className={`text-lg font-bold ${disc.text}`}>{disc.he}</span>
            <span className="text-sm text-zinc-500">
              {disc.colorName} · {disc.tagline}
            </span>
          </div>
        </Panel>

        <Panel eyebrow="ניתוח ביצועים" title="כרטיס ציון — איש המכירות">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DEMO_CATEGORIES.map((c) => {
              const sc = scorecardScoreColor(c.score);
              return (
                <div key={c.key} className="text-center">
                  <p className="truncate text-xs text-zinc-500">{c.label}</p>
                  <div className="mt-1.5 flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`h-1.5 w-1.5 rounded-full ${
                          n <= c.score ? sc.dot : "bg-zinc-800"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="flex flex-wrap gap-2">
          <Pill tone="positive">איתות קנייה זוהה</Pill>
          <Pill tone="warn">2 התנגדויות טופלו חלקית</Pill>
        </div>
      </div>
    </div>
  );
}
