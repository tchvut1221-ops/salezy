"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Analysis, AnalysisStatus } from "@/types";
import { ExecutiveSummary } from "./executive-summary";
import { ScoreGauge } from "./score-gauge";
import { DealIntelligence } from "./deal-intelligence";
import { ObjectionTracker } from "./objection-tracker";
import { KeyMoments } from "./key-moments";
import { NextSteps } from "./next-steps";
import { PersonalityCard } from "./personality-card";
import { LoadingMessages } from "./loading-messages";
import { ResultSkeleton } from "./result-skeleton";

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

export function AnalysisView({ initial }: { initial: Analysis }) {
  const [analysis, setAnalysis] = useState<Analysis>(initial);

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

  const isReady = analysis.status === "completed" && Boolean(analysis.result);

  return (
    <div>
      {/* כפתור "הורד PDF" — מחוץ ל-#analysis-content ומוסתר בהדפסה. */}
      {isReady && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            הורד PDF
          </button>
        </div>
      )}

      <div id="analysis-content">
        <h1 className="text-2xl font-bold text-foreground">{analysis.file_name}</h1>

        {analysis.status === "failed" ? (
          <p className="mt-6 rounded-lg bg-score-low/10 p-4 text-sm text-score-low">
            הניתוח נכשל. נסה להעלות את הקובץ שוב.
          </p>
        ) : isReady && analysis.result ? (
          <Result result={analysis.result} />
        ) : (
          <Progress status={analysis.status} />
        )}
      </div>
    </div>
  );
}

function Progress({ status }: { status: AnalysisStatus }) {
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
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
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
