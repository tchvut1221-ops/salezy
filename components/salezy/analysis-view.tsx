"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { retryAnalysis } from "@/app/actions";
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

  const isReady = analysis.status === "completed" && Boolean(analysis.result);

  const isCancelled = analysis.status === "cancelled";

  return (
    <div>
      {/* כפתורי פעולה — מחוץ ל-#analysis-content ומוסתרים בהדפסה. מחיקה זמינה
          תמיד; PDF רק כשהניתוח מוכן. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <DeleteAnalysisButton analysisId={initial.id} />
        {isReady && (
          <Button onClick={() => window.print()}>הורד PDF</Button>
        )}
      </div>

      <div id="analysis-content">
        <h1 className="text-2xl font-bold text-foreground">{analysis.file_name}</h1>

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
            {isCancelled ? (
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

  return (
    <div className="mt-8 space-y-5">
      {/* ── v2 enriched cards — each guarded on its own data so v1-only results
          (no v2 fields at all) render none of this and fall through cleanly
          to the original 3-card view below. ── */}
      {result.executiveSummary && (
        <ExecutiveSummary
          summary={result.executiveSummary}
          callObjective={result.callObjective}
          achieved={result.callObjectiveAchieved}
        />
      )}

      {typeof overallScore === "number" && (
        <ScoreGauge
          overall={overallScore}
          scores={result.salespersonPerformance.scores}
        />
      )}

      {hasDealIntelligence && (
        <DealIntelligence
          dealStage={result.dealStage}
          buyingSignals={result.buyingSignals}
          competitors={result.competitorsMentioned}
        />
      )}

      {result.objections && result.objections.length > 0 && (
        <ObjectionTracker objections={result.objections} />
      )}

      {result.keyMoments && result.keyMoments.length > 0 && (
        <KeyMoments moments={result.keyMoments} />
      )}

      {result.nextSteps && result.nextSteps.length > 0 && (
        <NextSteps steps={result.nextSteps} />
      )}

      {hasStageAnalysis && scorecard && (
        <StageAnalysis scorecard={scorecard} />
      )}

      {result.salespersonScorecard && (
        <Scorecard scorecard={result.salespersonScorecard} />
      )}

      {(result.coachingActions?.length || result.weeklyFocus) && (
        <CoachingPlan actions={result.coachingActions} weeklyFocus={result.weeklyFocus} />
      )}

      {/* ── v1 core — always present. The personality card self-degrades when the
          enriched DISC fields are absent (legacy analyses). ── */}
      <PersonalityCard personality={result.customerPersonality} />

      <Card title="ביצועי איש המכירות">
        <List label="מה עבד" items={result.salespersonPerformance.whatWorked} />
        <List label="מה פספס" items={result.salespersonPerformance.whatDidnt} />
        <List label="טיפים" items={result.salespersonPerformance.tips} />
      </Card>

      <Card title="צרכי הלקוח">
        <List label="גלוי" items={result.customerNeeds.explicit} />
        <List label="סמוי" items={result.customerNeeds.implicit} />
      </Card>
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
