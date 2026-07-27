"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Panel, Button, scoreColor, scorecardScoreColor } from "./ui";
import { AnalysisSection } from "./analysis-section";
import { ExecutiveSummary } from "./executive-summary";
import { ScoreGauge } from "./score-gauge";
import { DealIntelligence } from "./deal-intelligence";
import { ObjectionTracker } from "./objection-tracker";
import { KeyMoments } from "./key-moments";
import { NextSteps } from "./next-steps";
import { StageAnalysis } from "./stage-analysis";
import { Scorecard } from "./scorecard";
import { CoachingPlan } from "./coaching-plan";
import { PersonalityCard } from "./personality-card";
import { PERSONALITY_TYPE_META } from "@/lib/disc-reference";
import { PERSONALITY_TYPE_ICON, ICON_STROKE_WIDTH } from "./icons";
import { PracticeDialog } from "./practice-dialog";
import type {
  AnalysisResult,
  CoachingPriority,
  ScorecardCategoryKey,
  PracticeSectionKey,
} from "@/types";

const PRIORITY_RANK: Record<CoachingPriority, number> = { high: 0, medium: 1, low: 2 };

const SCORECARD_CATEGORIES: ScorecardCategoryKey[] = [
  "opening",
  "discovery",
  "pitch",
  "objectionHandling",
  "closing",
];

const SCORECARD_CATEGORY_LABEL: Record<ScorecardCategoryKey, string> = {
  opening: "פתיחה",
  discovery: "גילוי צרכים",
  pitch: "הצגת פתרון",
  objectionHandling: "טיפול בהתנגדויות",
  closing: "סגירה",
};

// Fixed per-slot delays, same convention as the previous long-form view
// (components/salezy/analysis-view.tsx) — a decorative entrance stagger, not
// worth recomputing indices for conditionally rendered sections.
const DELAY = (step: number) => ({ animationDelay: `${step * 60}ms` });

/**
 * The analysis result, reshaped from one long scrolling document into 4
 * progressive-disclosure cards (components/salezy/analysis-section.tsx) so a
 * user sees only the highlights first. Every field the previous long-form view
 * rendered is still rendered here — nothing is deleted, it's relocated into a
 * section's `details` (hidden until "פרטים נוספים" is clicked).
 */
export function AnalysisSections({
  analysisId,
  result,
}: {
  analysisId: string;
  result: AnalysisResult;
}) {
  const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(new Set());
  const [practiceTarget, setPracticeTarget] = useState<{
    sectionKey: PracticeSectionKey;
    focusText: string;
  } | null>(null);

  // Sticky progress: once a section has been opened it stays counted even if
  // the user collapses it again, so the bar reads as cumulative progress
  // through the analysis rather than "how many are open right now".
  function markOpened(id: string) {
    setOpenedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  const scorecard = result.salespersonScorecard;

  // ── Section 1 — שיחת המכירה ──
  const overallScore = result.overallScore ?? result.salespersonPerformance.overallScore;

  const strength = scorecard?.strengths[0] ?? result.salespersonPerformance.whatWorked[0] ?? null;

  const topCoachingAction = useMemo(() => {
    const actions = result.coachingActions;
    if (!actions?.length) return undefined;
    return [...actions].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0];
  }, [result.coachingActions]);

  const improvement =
    topCoachingAction?.action ??
    scorecard?.improvementAreas[0] ??
    result.salespersonPerformance.whatDidnt[0] ??
    null;

  const hasDealIntelligence =
    Boolean(result.dealStage && result.dealStage !== "unknown") ||
    Boolean(result.buyingSignals?.positive.length) ||
    Boolean(result.buyingSignals?.negative.length) ||
    Boolean(result.competitorsMentioned?.length);

  const section1Summary = (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        {typeof overallScore === "number" ? (
          <span
            className={`font-mono text-4xl font-bold tabular-nums ${scoreColor(overallScore).text}`}
          >
            {Math.round(overallScore)}
          </span>
        ) : (
          <span className="text-lg text-zinc-500">אין ציון זמין</span>
        )}
        {typeof overallScore === "number" && (
          <span className="text-sm text-zinc-500">מתוך 100</span>
        )}
      </div>
      {strength && <HighlightRow tone="positive" label="נקודת חוזק" text={strength} />}
      {improvement && <HighlightRow tone="negative" label="נקודה לשיפור" text={improvement} />}
    </div>
  );

  const section1Details = (
    <>
      {result.executiveSummary && (
        <ExecutiveSummary
          summary={result.executiveSummary}
          callObjective={result.callObjective}
          achieved={result.callObjectiveAchieved}
        />
      )}
      {typeof overallScore === "number" && (
        <ScoreGauge overall={overallScore} scores={result.salespersonPerformance.scores} />
      )}
      {hasDealIntelligence && (
        <DealIntelligence
          dealStage={result.dealStage}
          buyingSignals={result.buyingSignals}
          competitors={result.competitorsMentioned}
        />
      )}
      <Panel title="ביצועי איש המכירות">
        <ListBlock label="מה עבד" items={result.salespersonPerformance.whatWorked} />
        <ListBlock label="מה פספס" items={result.salespersonPerformance.whatDidnt} />
        <ListBlock label="טיפים" items={result.salespersonPerformance.tips} />
      </Panel>
      {/* weeklyFocus deliberately omitted here — section 2 owns it entirely. */}
      <CoachingPlan actions={result.coachingActions} />
      {result.objections && result.objections.length > 0 && (
        <ObjectionTracker objections={result.objections} />
      )}
      {result.keyMoments && result.keyMoments.length > 0 && (
        <KeyMoments moments={result.keyMoments} />
      )}
    </>
  );

  // ── Section 2 — Follow-up ──
  const weeklyFocus = result.weeklyFocus;
  const firstNextStep = result.nextSteps?.[0];

  const section2Summary = weeklyFocus ? (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-5">
      <p className="text-sm font-medium text-primary">היעד המרכזי לשבוע</p>
      <p className="mt-1 text-zinc-100">{weeklyFocus.primaryGoal}</p>
      <p className="mt-2 text-sm text-zinc-400">
        איך תדע שהצלחת: {weeklyFocus.successMetric}
      </p>
    </div>
  ) : firstNextStep ? (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-5">
      <p className="text-sm font-medium text-primary">המשימה הבאה</p>
      <p className="mt-1 text-zinc-100">{firstNextStep.action}</p>
    </div>
  ) : (
    <p className="text-sm text-zinc-500">אין עדיין המלצות המשך טיפול לשיחה זו.</p>
  );

  // Only the full next-steps list is new information beyond the summary —
  // weeklyFocus has just the two fields already shown above, so there's
  // nothing further to reveal for it specifically.
  const section2Details =
    result.nextSteps && result.nextSteps.length > 0 ? (
      <NextSteps steps={result.nextSteps} />
    ) : undefined;

  // ── Section 3 — סגנון הלקוח ──
  const hasCustomerNeeds = Boolean(
    result.customerNeeds.explicit.length || result.customerNeeds.implicit.length
  );

  const section3Details = (
    <>
      <PersonalityCard personality={result.customerPersonality} hideSignals />
      {hasCustomerNeeds && (
        <Panel title="צרכי הלקוח">
          <ListBlock label="גלוי" items={result.customerNeeds.explicit} />
          <ListBlock label="סמוי" items={result.customerNeeds.implicit} />
        </Panel>
      )}
    </>
  );

  // ── Section 4 — Scorecard שלך ──
  const overallScorecardScore = scorecard?.overallScorecardScore ?? null;

  const weakestCategory = useMemo(() => {
    if (!scorecard) return null;
    let weakest: { key: ScorecardCategoryKey; score: number } | null = null;
    for (const key of SCORECARD_CATEGORIES) {
      const s = scorecard[key]?.score;
      if (s == null) continue;
      if (!weakest || s < weakest.score) weakest = { key, score: s };
    }
    return weakest;
  }, [scorecard]);

  const hasStageAnalysis =
    scorecard != null &&
    SCORECARD_CATEGORIES.some(
      (k) => scorecard[k]?.sentiment != null || scorecard[k]?.failurePoint != null
    );

  const section4Summary = scorecard ? (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        {overallScorecardScore != null ? (
          <span
            className={`font-mono text-4xl font-bold tabular-nums ${scorecardScoreColor(overallScorecardScore).text}`}
          >
            {overallScorecardScore.toFixed(2)}
          </span>
        ) : (
          <span className="text-lg text-zinc-500">אין מספיק נתונים</span>
        )}
        <span className="text-sm text-zinc-500">מתוך 5</span>
      </div>
      {weakestCategory ? (
        <div className="rounded-xl border border-score-low/25 bg-score-low/5 p-4">
          <p className="text-sm font-medium text-score-low">
            התחום הכי חלש: {SCORECARD_CATEGORY_LABEL[weakestCategory.key]}
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-zinc-400">
            {weakestCategory.score}/5
          </p>
          {scorecard[weakestCategory.key].rationale && (
            <p className="mt-1 text-sm text-zinc-400">
              {scorecard[weakestCategory.key].rationale}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">אין מספיק נתונים לזהות תחום לשיפור.</p>
      )}
    </div>
  ) : (
    <p className="text-sm text-zinc-500">אין עדיין Scorecard לשיחה זו.</p>
  );

  const section4Details = scorecard ? (
    <>
      {hasStageAnalysis && <StageAnalysis scorecard={scorecard} />}
      <Scorecard scorecard={scorecard} />
    </>
  ) : undefined;

  const sections = [
    {
      id: "sales-call",
      title: "שיחת המכירה",
      summary: section1Summary,
      details: section1Details as ReactNode | undefined,
      practiceEnabled: Boolean(improvement),
      onPracticeClick: () =>
        improvement && setPracticeTarget({ sectionKey: "sales_call", focusText: improvement }),
    },
    {
      id: "followup",
      title: "Follow-up",
      summary: section2Summary,
      details: section2Details,
      practiceEnabled: Boolean(weeklyFocus),
      onPracticeClick: () =>
        weeklyFocus &&
        setPracticeTarget({ sectionKey: "followup", focusText: weeklyFocus.primaryGoal }),
    },
    {
      id: "customer-style",
      title: "סגנון הלקוח",
      summary: <CustomerStyleSummary personality={result.customerPersonality} />,
      details: section3Details as ReactNode | undefined,
      practiceEnabled: true,
      onPracticeClick: () =>
        setPracticeTarget({
          sectionKey: "customer_style",
          focusText: `לתרגל תקשורת עם לקוח מסוג ${PERSONALITY_TYPE_META[result.customerPersonality.type].he}`,
        }),
    },
    {
      id: "scorecard",
      title: "Scorecard שלך",
      summary: section4Summary,
      details: section4Details,
      practiceEnabled: Boolean(weakestCategory),
      onPracticeClick: () =>
        weakestCategory &&
        setPracticeTarget({
          sectionKey: "scorecard",
          focusText: `לתרגל שיפור ב${SCORECARD_CATEGORY_LABEL[weakestCategory.key]}`,
        }),
    },
  ];

  const totalWithDetails = sections.filter((s) => Boolean(s.details)).length;
  const openedCount = sections.filter((s) => Boolean(s.details) && openedIds.has(s.id)).length;

  return (
    <div className="mt-8 space-y-6">
      <ProgressBar opened={openedCount} total={totalWithDetails} />

      {sections.map((s, i) => (
        <div key={s.id} className="animate-fade-up" style={DELAY(i)}>
          <AnalysisSection
            title={s.title}
            summary={s.summary}
            details={s.details}
            practiceEnabled={s.practiceEnabled}
            onPracticeClick={s.onPracticeClick}
            onOpenChange={(open) => {
              if (open) markOpened(s.id);
            }}
          />
        </div>
      ))}

      <PracticeDialog
        key={practiceTarget ? `${practiceTarget.sectionKey}:${practiceTarget.focusText}` : "closed"}
        open={practiceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPracticeTarget(null);
        }}
        analysisId={analysisId}
        sectionKey={practiceTarget?.sectionKey ?? "sales_call"}
        focusText={practiceTarget?.focusText ?? ""}
        personalityType={result.customerPersonality.type}
      />
    </div>
  );
}

function ProgressBar({ opened, total }: { opened: number; total: number }) {
  if (total === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-zinc-400">התקדמות בניתוח</span>
        <span>
          <span className="font-mono tabular-nums text-primary">
            {opened}/{total}
          </span>{" "}
          <span className="text-zinc-500">חלקים נפתחו</span>
        </span>
      </div>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={opened}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="התקדמות בפתיחת חלקי הניתוח"
      >
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < opened ? "bg-primary" : "bg-zinc-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function HighlightRow({
  tone,
  label,
  text,
}: {
  tone: "positive" | "negative";
  label: string;
  text: string;
}) {
  const dot = tone === "positive" ? "bg-score-high" : "bg-score-low";
  const head = tone === "positive" ? "text-score-high" : "text-score-low";
  return (
    <div className="flex gap-2 text-sm">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <p className="text-zinc-300">
        <span className={`font-medium ${head}`}>{label}: </span>
        {text}
      </p>
    </div>
  );
}

/**
 * Self-contained: owns the "למה זיהיתי ככה?" reveal, separate from the
 * section's own "פרטים נוספים" toggle. Shows only the first 2 signals up
 * front; the rest expand inline on click. The full PersonalityCard (with
 * hideSignals) lives in this section's `details` instead, so the quotes
 * never render twice on screen at once.
 */
function CustomerStyleSummary({
  personality,
}: {
  personality: AnalysisResult["customerPersonality"];
}) {
  const [showRest, setShowRest] = useState(false);
  const restId = useId();
  const { type, indeterminate, explanation, signals } = personality;
  const meta = PERSONALITY_TYPE_META[type];
  const Icon = PERSONALITY_TYPE_ICON[type];

  if (indeterminate) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full bg-zinc-600" />
          <span className="text-lg font-semibold text-zinc-300">לא ניתן לקבוע בביטחון</span>
        </div>
        <p className="text-sm leading-relaxed text-zinc-400">{explanation}</p>
      </div>
    );
  }

  const shown = signals?.slice(0, 2) ?? [];
  const rest = signals?.slice(2) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className={`h-5 w-5 ${meta.text}`} strokeWidth={ICON_STROKE_WIDTH} />
        <span className={`text-2xl font-bold ${meta.text}`}>{meta.he}</span>
        <span className="text-sm text-zinc-500">
          {meta.colorName} · {meta.tagline}
        </span>
      </div>

      {shown.length > 0 && (
        <ul className="space-y-2.5">
          {shown.map((s, i) => (
            <li key={i} className="border-s-2 border-zinc-700 ps-3 text-sm">
              <p className="text-zinc-200">&ldquo;{s.quote}&rdquo;</p>
              <p className="mt-0.5 text-zinc-500">{s.interpretation}</p>
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRest((v) => !v)}
            aria-expanded={showRest}
            aria-controls={restId}
          >
            {showRest ? "הסתר ציטוטים נוספים" : "למה זיהיתי ככה?"}
          </Button>
          {showRest && (
            <ul id={restId} className="mt-3 space-y-2.5">
              {rest.map((s, i) => (
                <li key={i} className="border-s-2 border-zinc-700 ps-3 text-sm">
                  <p className="text-zinc-200">&ldquo;{s.quote}&rdquo;</p>
                  <p className="mt-0.5 text-zinc-500">{s.interpretation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-zinc-200">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
