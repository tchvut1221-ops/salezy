"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { retryAnalysis } from "@/app/actions";
import { AUDIO_RETENTION_DAYS } from "@/lib/retention-policy";
import { exportElementToPdf, toPdfFileName } from "@/lib/export-pdf";
import type { Analysis, AnalysisStatus } from "@/types";
import { AnalysisSections } from "./analysis-sections";
import { TranscriptView } from "./transcript-view";
import { LoadingMessages } from "./loading-messages";
import { ResultSkeleton } from "./result-skeleton";
import { ICON_STROKE_WIDTH } from "./icons";
import {
  StopAnalysisButton,
  DeleteAnalysisButton,
  ResumeAnalysisButton,
} from "./analysis-actions";
import { Button, Alert } from "./ui";

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

export function AnalysisView({
  initial,
  isFirstAnalysis = false,
}: {
  initial: Analysis;
  /** D6 celebration: true when no OTHER completed analysis exists for this
   *  user yet (computed server-side in the page). Self-resolving — once a
   *  second analysis completes, this is false everywhere, so no dismissal
   *  state needs to be persisted. */
  isFirstAnalysis?: boolean;
}) {
  const [analysis, setAnalysis] = useState<Analysis>(initial);
  const [retrying, startRetry] = useTransition();
  const [exportingPdf, startExportPdf] = useTransition();
  const [showCelebration, setShowCelebration] = useState(isFirstAnalysis);

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

      {/* D6 first-analysis celebration — outside #analysis-content on
          purpose, same as the action row above: it's a one-time UI moment,
          not part of the exported/printed report. */}
      {isReady && showCelebration && (
        <Alert tone="info" className="mb-4">
          <div className="flex items-start gap-3">
            <Sparkles
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              strokeWidth={ICON_STROKE_WIDTH}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">הניתוח הראשון שלך מוכן!</p>
              <p className="mt-1 text-sm text-zinc-400">
                עברו על הכרטיסים למטה כדי לראות את פרופיל הלקוח, כרטיס הציון שלך, והצעדים
                הבאים המומלצים.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCelebration(false)}
              aria-label="סגור הודעה"
              className="shrink-0 rounded-lg p-1 text-zinc-500 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            </button>
          </div>
        </Alert>
      )}

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
          <Alert className="mt-6">
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
          </Alert>
        ) : isReady && analysis.result ? (
          <AnalysisSections analysisId={initial.id} result={analysis.result} />
        ) : (
          <Progress status={analysis.status} analysisId={initial.id} />
        )}
      </div>

      {/*
        התמלול — מחוץ ל-#analysis-content בכוונה (ראה ההסבר למטה), ולכן אינו
        נכלל ב"הורד PDF". ממוקם מיד אחרי כרטיס ה-Scorecard כדי שהציטוטים
        המסומנים והקטגוריה שהם מבססים יישבו זה לצד זה.

        Placed OUTSIDE #analysis-content deliberately, so the "הורד PDF" export
        (lib/export-pdf.ts, html2canvas over #analysis-content) does not include
        it. Three reasons, in order of weight:
         1. Correctness. That export rasterizes the whole node into ONE canvas
            and slices it into A4 pages. A 30-minute call transcript adds
            thousands of pixels of height at scale:2, and browsers cap canvas
            dimensions (~32k px in Chrome) — past that html2canvas yields a
            blank or truncated bitmap, so including it would risk silently
            breaking an export that works today.
         2. Privacy. The transcript is verbatim customer speech. Keeping it out
            of a one-click, easily-forwarded file is the more conservative
            default, and matches the disclosure this panel carries.
         3. Precedent. The delete/PDF action bar above is already deliberately
            outside #analysis-content for the same "not part of the report"
            reason.
        The transcript is still on the page, still selectable and copyable —
        this only scopes the generated file. app/(app)/analysis/[id]/print.css
        additionally sets `display: none` on this wrapper, because print.css
        hides non-report content with `visibility: hidden`, which would
        otherwise leave the transcript's full height behind as blank pages.

        Rendered whenever a completed analysis exists (even with a null
        transcript — that's the legacy/empty case the panel handles itself), and
        also on a terminal failure that nonetheless produced a transcript, since
        the words spoken are still worth reading when the analysis didn't land.
      */}
      {(isReady || (isDone && Boolean(analysis.transcript))) && (
        <div id="call-transcript">
          <TranscriptView transcript={analysis.transcript} result={analysis.result} />
        </div>
      )}
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
      <div role="status" aria-live="polite">
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
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <StopAnalysisButton analysisId={analysisId} />
        <DeleteAnalysisButton analysisId={analysisId} />
      </div>
      <ResultSkeleton />
    </div>
  );
}

// The result renderer (4 progressive-disclosure sections) lives in
// ./analysis-sections — see AnalysisSections.
