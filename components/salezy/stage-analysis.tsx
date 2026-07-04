"use client";

import {
  DoorOpen,
  Search,
  Presentation,
  ShieldQuestion,
  Handshake,
} from "lucide-react";
import { Panel, Pill, scorecardScoreColor } from "./ui";
import type {
  AnalysisResult,
  ScorecardCategory,
  ScorecardCategoryKey,
} from "@/types";

type Scorecard = NonNullable<AnalysisResult["salespersonScorecard"]>;

// Chronological order of the five sales stages. Labels + icons mirror the
// scorecard's CATEGORY_META so a call is described with the same vocabulary in
// both cards — this "journey" view is flow/sentiment-oriented, the scorecard is
// skills/quote-oriented, but they read the same underlying salespersonScorecard.
const STAGES: { key: ScorecardCategoryKey; label: string; icon: typeof DoorOpen }[] = [
  { key: "opening", label: "פתיחה", icon: DoorOpen },
  { key: "discovery", label: "גילוי צרכים", icon: Search },
  { key: "pitch", label: "הצגת פתרון", icon: Presentation },
  { key: "objectionHandling", label: "טיפול בהתנגדויות", icon: ShieldQuestion },
  { key: "closing", label: "סגירה", icon: Handshake },
];

const SENTIMENT_META: Record<
  NonNullable<ScorecardCategory["sentiment"]>,
  { label: string; tone: "positive" | "neutral" | "negative" }
> = {
  positive: { label: "סנטימנט חיובי", tone: "positive" },
  neutral: { label: "סנטימנט ניטרלי", tone: "neutral" },
  negative: { label: "סנטימנט שלילי", tone: "negative" },
};

function ScoreDots({ score }: { score: number | null }) {
  const sc = score != null ? scorecardScoreColor(score) : null;
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = score != null && n <= score;
        return (
          <span
            key={n}
            className={`h-2.5 w-2.5 rounded-full ${filled && sc ? sc.dot : "bg-zinc-700"}`}
          />
        );
      })}
    </div>
  );
}

function StageRow({
  stage,
  category,
  isLast,
}: {
  stage: (typeof STAGES)[number];
  category: ScorecardCategory;
  isLast: boolean;
}) {
  const Icon = stage.icon;
  const sc = category.score != null ? scorecardScoreColor(category.score) : null;
  const sentiment = category.sentiment ? SENTIMENT_META[category.sentiment] : null;

  return (
    <li className="flex gap-4">
      {/* Timeline rail: fixed icon node, then a growing connector to the next stage. */}
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950">
          <Icon className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
        </div>
        {!isLast && <span className="mt-1 w-px grow bg-zinc-800" aria-hidden />}
      </div>

      <div className="flex-1 pb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-medium text-zinc-200">{stage.label}</span>
          <div className="flex items-center gap-2">
            <ScoreDots score={category.score} />
            {category.score != null && sc && (
              <span className={`text-sm font-semibold ${sc.text}`}>{category.score}/5</span>
            )}
          </div>
          {sentiment && <Pill tone={sentiment.tone}>{sentiment.label}</Pill>}
        </div>

        {category.score == null && (
          <p className="mt-2 text-xs text-zinc-600">שלב זה לא זוהה בשיחה</p>
        )}

        {category.quote && (
          <blockquote className="mt-3 rounded-lg border-e-4 border-primary bg-zinc-950/40 px-4 py-2.5 text-sm text-zinc-300">
            &rdquo;{category.quote}&ldquo;
          </blockquote>
        )}

        {category.failurePoint && (
          <div className="mt-3 flex gap-2 rounded-lg border border-score-low/25 bg-score-low/5 px-4 py-2.5">
            <span className="mt-0.5 shrink-0 text-xs font-medium text-score-low">
              נקודת כשל
            </span>
            <p className="text-sm text-zinc-300">{category.failurePoint}</p>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Stage-by-stage "journey" of the call: the five sales stages in order, each with
 * its 1-5 score, per-stage sentiment, supporting quote, and failure point (where
 * that stage broke down). Reads the existing salespersonScorecard — no new data
 * source. Rendered only when the scorecard actually carries per-stage
 * sentiment/failurePoint (see AnalysisView), so pre-stage-analysis results don't
 * show a redundant near-copy of the Scorecard.
 */
export function StageAnalysis({ scorecard }: { scorecard: Scorecard }) {
  return (
    <Panel eyebrow="מסע השיחה" title="ניתוח לפי שלבים">
      <p className="mb-5 text-xs leading-relaxed text-zinc-500">
        חמשת שלבי השיחה לפי הסדר — לכל שלב ציון, הסנטימנט הרגשי, וזיהוי נקודת הכשל אם
        הייתה. הצצה לאיך השיחה זרמה, מהפתיחה ועד הסגירה.
      </p>
      <ol className="mt-1">
        {STAGES.map((stage, i) => (
          <StageRow
            key={stage.key}
            stage={stage}
            category={scorecard[stage.key]}
            isLast={i === STAGES.length - 1}
          />
        ))}
      </ol>
    </Panel>
  );
}
