"use client";

import {
  DoorOpen,
  Search,
  Presentation,
  ShieldQuestion,
  Handshake,
} from "lucide-react";
import { Panel, scorecardScoreColor } from "./ui";
import { useCountUp } from "./use-count-up";
import { Quote } from "./quote";
import type {
  AnalysisResult,
  ScorecardCategory,
  ScorecardCategoryKey,
  TalkRatioVerdict,
} from "@/types";

type Scorecard = NonNullable<AnalysisResult["salespersonScorecard"]>;

const CATEGORIES: ScorecardCategoryKey[] = [
  "opening",
  "discovery",
  "pitch",
  "objectionHandling",
  "closing",
];

const CATEGORY_META: Record<
  ScorecardCategoryKey,
  { label: string; icon: typeof DoorOpen }
> = {
  opening: { label: "פתיחה", icon: DoorOpen },
  discovery: { label: "גילוי צרכים", icon: Search },
  pitch: { label: "הצגת פתרון", icon: Presentation },
  objectionHandling: { label: "טיפול בהתנגדויות", icon: ShieldQuestion },
  closing: { label: "סגירה", icon: Handshake },
};

const VERDICT_LABEL: Record<TalkRatioVerdict, string> = {
  optimal: "יחס דיבור מאוזן ותואם לבנצ'מרק",
  below_optimal: "אתה מדבר פחות מהאופטימלי — ייתכן שאתה לא אסרטיבי מספיק בהובלת השיחה",
  above_optimal: "אתה מדבר יותר מדי — תן ללקוח יותר מקום להוביל",
};

function CategoryCard({
  categoryKey,
  category,
}: {
  categoryKey: ScorecardCategoryKey;
  category: ScorecardCategory;
}) {
  const meta = CATEGORY_META[categoryKey];
  const Icon = meta.icon;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-zinc-500" strokeWidth={1.5} />
        <span className="font-medium text-zinc-200">{meta.label}</span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = category.score != null && n <= category.score;
          const sc = category.score != null ? scorecardScoreColor(category.score) : null;
          return (
            <span
              key={n}
              className={`h-2.5 w-2.5 rounded-full ${filled && sc ? sc.dot : "bg-zinc-700"}`}
            />
          );
        })}
      </div>
      <p className="mt-3 text-sm text-zinc-400">{category.rationale}</p>
      {category.quote ? (
        <blockquote className="mt-3 rounded-lg border-e-4 border-primary bg-zinc-950/40 px-4 py-2.5 text-sm text-zinc-300">
          <Quote>{category.quote}</Quote>
        </blockquote>
      ) : (
        <p className="mt-3 text-xs text-zinc-600">לא רלוונטי לשיחה זו</p>
      )}
    </div>
  );
}

function TalkRatioCard({ talkRatio }: { talkRatio: Scorecard["talkRatio"] }) {
  if (!talkRatio) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center text-sm text-zinc-500 sm:col-span-2">
        לא ניתן היה להעריך יחס דיבור לשיחה זו
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:col-span-2">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-zinc-200">יחס דיבור / הקשבה</span>
        <span dir="ltr" className="font-mono text-3xl font-bold tabular-nums text-primary">
          {Math.round(talkRatio.repPercentage)}%
        </span>
      </div>
      <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-zinc-800" dir="ltr">
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-primary"
          style={{ width: `${talkRatio.repPercentage}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-zinc-400"
          style={{ insetInlineStart: "43%" }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
        <span>איש מכירות</span>
        <span>בנצ&apos;מרק 43%</span>
        <span>לקוח</span>
      </div>
      <p className="mt-3 text-sm text-zinc-400">{VERDICT_LABEL[talkRatio.verdict]}</p>
      <p className="mt-1 text-xs text-zinc-600">
        אידיאלי: 43% דיבור / 57% הקשבה (מחקר Gong Labs)
      </p>
    </div>
  );
}

export function Scorecard({ scorecard }: { scorecard: Scorecard }) {
  const overall = scorecard.overallScorecardScore;
  const display = useCountUp(overall ?? 0);
  const sc = overall != null ? scorecardScoreColor(overall) : null;

  return (
    <Panel eyebrow="דירוג מבוסס ציטוטים" title="ניתוח ביצועים — איש המכירות">
      <p className="mb-5 text-xs leading-relaxed text-zinc-500">
        ציון זה מבוסס על ציטוטים ספציפיים מהשיחה ונפרד מ&quot;ציון השיחה&quot; הכללי
        למעלה — הוא בודק התנהגויות ספציפיות של איש המכירות, לא את השיחה בכללותה.
      </p>

      <div className="mb-6 text-center">
        {overall != null ? (
          <span className={`font-mono text-5xl font-bold tabular-nums ${sc!.text}`}>
            {display.toFixed(2)}
          </span>
        ) : (
          <span className="text-lg text-zinc-500">אין מספיק נתונים</span>
        )}
        <p className="mt-1 text-xs text-zinc-500">ציון סקורקארד כולל (מתוך 5)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((key) => (
          <CategoryCard key={key} categoryKey={key} category={scorecard[key]} />
        ))}
        <TalkRatioCard talkRatio={scorecard.talkRatio} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-score-high/25 bg-score-high/5 p-5">
          <p className="mb-2 text-sm font-medium text-score-high">חוזקות</p>
          <ul className="space-y-1.5 text-sm text-zinc-300">
            {scorecard.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-score-low/25 bg-score-low/5 p-5">
          <p className="mb-2 text-sm font-medium text-score-low">תחומים לשיפור</p>
          <ul className="space-y-1.5 text-sm text-zinc-300">
            {scorecard.improvementAreas.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
