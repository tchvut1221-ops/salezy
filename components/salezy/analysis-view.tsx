"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { retryAnalysis } from "@/app/actions";
import { AUDIO_RETENTION_DAYS } from "@/lib/retention-policy";
import { exportElementToPdf, toPdfFileName } from "@/lib/export-pdf";
import type { Analysis, AnalysisStatus } from "@/types";
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
import { LoadingMessages } from "./loading-messages";
import { ResultSkeleton } from "./result-skeleton";
import {
  StopAnalysisButton,
  DeleteAnalysisButton,
  ResumeAnalysisButton,
} from "./analysis-actions";
import { Button, Panel } from "./ui";
import { SectionNav, type SectionNavItem } from "./section-nav";

const STEPS: { key: AnalysisStatus; label: string }[] = [
  { key: "uploaded", label: "הועלה" },
  { key: "converting", label: "ממיר קובץ" },
  { key: "transcribing", label: "מתמלל" },
  { key: "analyzing", label: "מנתח" },
  { key: "completed", label: "מוכן" },
];

function stepIndex(status: AnalysisStatus): number {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

const TERMINAL: AnalysisStatus[] = [
  "completed",
  "failed",
  "no_speech_detected",
  "cancelled",
];

export function AnalysisView({ initial }: { initial: Analysis }) {
  const [analysis, setAnalysis] = useState<Analysis>(initial);
  const [retrying, startRetry] = useTransition();
  const [exportingPdf, startExportPdf] = useTransition();

  const isDone = TERMINAL.includes(analysis.status);

  // Primary live updates: Supabase Realtime pushes row UPDATEs instantly.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`analysis-${initial.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analyses",
          // Scoped by id AND user_id (not just id) so this subscription can
          // never deliver another user's row even if RLS were misconfigured.
          filter: `id=eq.${initial.id}`,
        },
        (payload) => {
          const next = payload.new as Analysis;
          if (next.user_id === initial.user_id) setAnalysis(next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initial.id, initial.user_id]);

  // Fallback: poll every 4s while the analysis is still in flight, in case the
  // Realtime WebSocket dropped or never connected (proxies, flaky networks).
  // Stops as soon as we reach a terminal state, so a finished analysis polls
  // nothing.
  useEffect(() => {
    if (isDone) return;
    const supabase = createClient();
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("analyses")
        .select("*")
        .eq("id", initial.id)
        .single();
      if (data) setAnalysis(data as Analysis);
    }, 4000);
    return () => clearInterval(interval);
  }, [initial.id, isDone]);

  function onRetry() {
    // Optimistically flip back to the progress view; the pipeline + live updates
    // take over from here.
    setAnalysis((a) => ({ ...a, status: "uploaded", error: null }));
    startRetry(async () => {
      try {
        await retryAnalysis(initial.id);
      } catch {
        setAnalysis((a) => ({ ...a, status: "failed" }));
        toast.error("לא הצלחנו להתחיל את הניתוח מחדש. נסו שוב.");
      }
    });
  }

  function onExportPdf() {
    startExportPdf(async () => {
      try {
        await exportElementToPdf("analysis-content", toPdfFileName(analysis.file_name));
      } catch (err) {
        console.error("[AnalysisView] PDF export failed:", err);
        toast.error("יצירת ה-PDF נכשלה. נסו שוב.");
      }
    });
  }

  const isReady = analysis.status === "completed" && Boolean(analysis.result);

  const isCancelled = analysis.status === "cancelled";

  // Whether a re-run is even possible: once the retention sweep deleted the
  // raw recording (lib/inngest/retention.ts), retry/resume only work if
  // transcription already finished — the pipeline then reads the persisted
  // transcript instead of the audio. Mirrors the guards in app/actions.ts.
  const audioDeleted = Boolean(analysis.audio_deleted_at);
  const canReprocess =
    !audioDeleted ||
    ((analysis.completed_steps ?? []).includes("transcribe") &&
      Boolean(analysis.transcript));

  return (
    <div>
      {/* כפתורי פעולה — מחוץ ל-#analysis-content ומוסתרים בהדפסה. מחיקה זמינה
          תמיד; PDF רק כשהניתוח מוכן. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <DeleteAnalysisButton analysisId={initial.id} />
        {isReady && (
          <Button onClick={onExportPdf} disabled={exportingPdf}>
            {exportingPdf ? "מכין PDF..." : "הורד PDF"}
          </Button>
        )}
      </div>

      <div id="analysis-content">
        <h1 className="text-2xl font-bold text-foreground">{analysis.file_name}</h1>
        {audioDeleted && isReady && (
          <p className="mt-1 text-xs text-zinc-500">
            ההקלטה המקורית נמחקה בהתאם למדיניות השמירה ({AUDIO_RETENTION_DAYS}{" "}
            יום) — התמלול והניתוח נשמרים.
          </p>
        )}

        {analysis.status === "failed" ||
        analysis.status === "no_speech_detected" ||
        isCancelled ? (
          <div className="mt-6 rounded-lg border border-score-low/30 bg-score-low/10 p-5">
            <p className="text-sm font-medium text-score-low">
              {isCancelled
                ? "הניתוח בוטל"
                : analysis.status === "no_speech_detected"
                  ? "לא זוהה דיבור"
                  : "הניתוח נכשל"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {isCancelled
                ? "עצרת את הניתוח הזה לפני שהסתיים."
                : analysis.status === "no_speech_detected"
                  ? "לא זוהה דיבור בהקלטה הזו. ודא שהקובץ מכיל שיחה אמיתית ונסה שוב."
                  : "נתקלנו בתקלה בעיבוד ההקלטה. אפשר לנסות שוב — הקובץ שכבר העליתם נשמר."}
            </p>
            {!canReprocess ? (
              <p className="mt-4 text-xs text-zinc-500">
                ההקלטה נמחקה מהשרתים בהתאם למדיניות השמירה (
                {AUDIO_RETENTION_DAYS} יום), ולכן לא ניתן להריץ את הניתוח
                מחדש.
              </p>
            ) : isCancelled ? (
              <div className="mt-4">
                <ResumeAnalysisButton analysisId={initial.id} />
              </div>
            ) : (
              <Button onClick={onRetry} disabled={retrying} className="mt-4">
                {retrying ? "מתחיל מחדש..." : "נסה שוב"}
              </Button>
            )}
          </div>
        ) : isReady && analysis.result ? (
          <Result result={analysis.result} />
        ) : (
          <Progress status={analysis.status} analysisId={initial.id} />
        )}
      </div>
    </div>
  );
}

function Progress({
  status,
  analysisId,
}: {
  status: AnalysisStatus;
  analysisId: string;
}) {
  const current = stepIndex(status);
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            <div
              className={`h-2 w-full rounded-full transition-colors ${
                i <= current ? "bg-primary" : "bg-zinc-800"
              }`}
            />
            <span
              className={`mt-2 text-xs ${
                i <= current ? "text-primary" : "text-zinc-500"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <LoadingMessages status={status} />
      <p className="mt-2 text-center text-xs text-zinc-600">
        אפשר להישאר בדף, הוא יתעדכן אוטומטית.
      </p>
      <div className="mt-4 flex justify-center gap-3">
        <StopAnalysisButton analysisId={analysisId} />
        <DeleteAnalysisButton analysisId={analysisId} />
      </div>
      <ResultSkeleton />
    </div>
  );
}

// Fixed per-slot delays (not renumbered when a card is hidden) — a
// decorative stagger, not worth recomputing indices for conditionally
// rendered cards. Below-the-fold sections finish this 40ms-stepped
// animation long before a user actually scrolls to them, which is fine —
// the entrance effect only needs to be visible for what's on screen at
// mount (the summary section).
const DELAY = (step: number) => ({ animationDelay: `${step * 40}ms` });

function Result({ result }: { result: NonNullable<Analysis["result"]> }) {
  const hasDealIntelligence =
    Boolean(result.dealStage && result.dealStage !== "unknown") ||
    Boolean(result.buyingSignals?.positive.length) ||
    Boolean(result.buyingSignals?.negative.length) ||
    Boolean(result.competitorsMentioned?.length);

  // The synthesis prompt asks the model for `overallScore` at both the
  // top level and nested under salespersonPerformance — the inngest pipeline's
  // dashboard snapshot already falls back to the nested one (lib/inngest/functions.ts),
  // so the gauge must use the same fallback or it can disappear on a call the
  // dashboard still counts as v2.
  const overallScore = result.overallScore ?? result.salespersonPerformance.overallScore;

  // Show the stage-by-stage timeline only when the scorecard actually carries the
  // per-stage sentiment/failurePoint added by Stage Analysis — otherwise it would
  // just re-list the scorecard's scores/quotes. Legacy + scorecard-era analyses
  // therefore render the Scorecard but not this card.
  const scorecard = result.salespersonScorecard;
  const hasStageAnalysis =
    scorecard != null &&
    (["opening", "discovery", "pitch", "objectionHandling", "closing"] as const).some(
      (k) => scorecard[k]?.sentiment != null || scorecard[k]?.failurePoint != null
    );

  const hasMoments = Boolean(result.keyMoments?.length) || Boolean(result.objections?.length);
  const hasFollowup = Boolean(result.nextSteps?.length);

  // Summary and Customer are always present (the v1 core — PersonalityCard
  // self-degrades on legacy data) so they're not gated; Performance, Key
  // Moments, and Follow-up only appear — in the nav and as sections — when
  // there's actually something to show.
  const sections: SectionNavItem[] = [
    { id: "summary", label: "סיכום" },
    { id: "performance", label: "ביצועים" },
    { id: "customer", label: "הלקוח" },
    ...(hasMoments ? [{ id: "moments", label: "רגעי מפתח" }] : []),
    ...(hasFollowup ? [{ id: "followup", label: "המשך טיפול" }] : []),
  ];

  return (
    <div className="mt-8 grid gap-8 xl:grid-cols-[200px_minmax(0,1fr)] xl:items-start">
      <SectionNav items={sections} />

      <div className="min-w-0 space-y-10">
        <section id="summary" className="scroll-mt-24 space-y-5">
          {result.executiveSummary && (
            <div className="animate-fade-up" style={DELAY(0)}>
              <ExecutiveSummary
                summary={result.executiveSummary}
                callObjective={result.callObjective}
                achieved={result.callObjectiveAchieved}
              />
            </div>
          )}

          {typeof overallScore === "number" && (
            <div className="animate-fade-up" style={DELAY(1)}>
              <ScoreGauge
                overall={overallScore}
                scores={result.salespersonPerformance.scores}
              />
            </div>
          )}
        </section>

        <section id="performance" className="scroll-mt-24 space-y-5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            ביצועים
          </h2>

          {hasDealIntelligence && (
            <div className="animate-fade-up" style={DELAY(2)}>
              <DealIntelligence
                dealStage={result.dealStage}
                buyingSignals={result.buyingSignals}
                competitors={result.competitorsMentioned}
              />
            </div>
          )}

          {hasStageAnalysis && scorecard && (
            <div className="animate-fade-up" style={DELAY(3)}>
              <StageAnalysis scorecard={scorecard} />
            </div>
          )}

          {result.salespersonScorecard && (
            <div className="animate-fade-up" style={DELAY(4)}>
              <Scorecard scorecard={result.salespersonScorecard} />
            </div>
          )}

          {(result.coachingActions?.length || result.weeklyFocus) && (
            <div className="animate-fade-up" style={DELAY(5)}>
              <CoachingPlan actions={result.coachingActions} weeklyFocus={result.weeklyFocus} />
            </div>
          )}

          {/* ── v1 core — always present. ── */}
          <div className="animate-fade-up" style={DELAY(6)}>
            <Card title="ביצועי איש המכירות">
              <List label="מה עבד" items={result.salespersonPerformance.whatWorked} />
              <List label="מה פספס" items={result.salespersonPerformance.whatDidnt} />
              <List label="טיפים" items={result.salespersonPerformance.tips} />
            </Card>
          </div>
        </section>

        <section id="customer" className="scroll-mt-24 space-y-5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            הלקוח
          </h2>

          {/* The personality card self-degrades when the enriched DISC fields
              are absent (legacy analyses). */}
          <div className="animate-fade-up" style={DELAY(7)}>
            <PersonalityCard personality={result.customerPersonality} />
          </div>

          <div className="animate-fade-up" style={DELAY(8)}>
            <Card title="צרכי הלקוח">
              <List label="גלוי" items={result.customerNeeds.explicit} />
              <List label="סמוי" items={result.customerNeeds.implicit} />
            </Card>
          </div>
        </section>

        {hasMoments && (
          <section id="moments" className="scroll-mt-24 space-y-5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              רגעי מפתח
            </h2>

            {result.objections && result.objections.length > 0 && (
              <div className="animate-fade-up" style={DELAY(9)}>
                <ObjectionTracker objections={result.objections} />
              </div>
            )}

            {result.keyMoments && result.keyMoments.length > 0 && (
              <div className="animate-fade-up" style={DELAY(10)}>
                <KeyMoments moments={result.keyMoments} />
              </div>
            )}
          </section>
        )}

        {hasFollowup && (
          <section id="followup" className="scroll-mt-24 space-y-5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              המשך טיפול
            </h2>

            {result.nextSteps && result.nextSteps.length > 0 && (
              <div className="animate-fade-up" style={DELAY(11)}>
                <NextSteps steps={result.nextSteps} />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <Panel title={title}>{children}</Panel>;
}

function List({ label, items }: { label: string; items: string[] }) {
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
