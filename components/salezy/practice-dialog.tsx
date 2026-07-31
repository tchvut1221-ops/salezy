"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Flame } from "lucide-react";
import { Button, Input, scorecardScoreColor } from "./ui";
import { HighlightRow } from "./analysis-sections";
import { ICON_STROKE_WIDTH } from "./icons";
import {
  startPracticeSession,
  sendPracticeMessage,
  endPracticeSession,
  getPracticeHistory,
} from "@/app/actions";
import type {
  PracticeSectionKey,
  PracticeSession,
  PracticeSessionOutcome,
  PersonalityType,
} from "@/types";

type DialogState =
  | { phase: "starting" }
  | { phase: "chat"; session: PracticeSession; isWaitingForReply: boolean; isEnding: boolean }
  | ({ phase: "feedback"; sessionId: string } & PracticeSessionOutcome)
  | { phase: "error"; message: string };

/**
 * The Practice Loop modal. Base UI's Dialog (components/salezy/ui.tsx notes
 * this project has zero existing modal component despite @base-ui/react
 * already being a dependency — this is the first user of it) gives real focus
 * trapping/ESC/backdrop-dismiss for free, which a hand-rolled div wouldn't,
 * and is justified here unlike this app's existing plain window.confirm()
 * dialogs — this is a genuinely stateful, multi-turn surface.
 */
export function PracticeDialog({
  open,
  onOpenChange,
  analysisId,
  sectionKey,
  focusText,
  personalityType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  sectionKey: PracticeSectionKey;
  focusText: string;
  personalityType: PersonalityType;
}) {
  const [state, setState] = useState<DialogState>({ phase: "starting" });
  const [draft, setDraft] = useState("");

  // Kick off a fresh session every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to "starting" is required here: this dialog is a single persistent instance whose `open` prop toggles (not remounted per session), so without this reset the PREVIOUS session's chat/feedback would flash briefly while the new startPracticeSession() call is in flight.
    setState({ phase: "starting" });
    setDraft("");
    startPracticeSession(analysisId, sectionKey, focusText, personalityType)
      .then((session) => {
        if (!ignore) setState({ phase: "chat", session, isWaitingForReply: false, isEnding: false });
      })
      .catch(() => {
        if (!ignore) setState({ phase: "error", message: "לא הצלחנו להתחיל את התרגול. נסו שוב." });
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on analysisId/sectionKey/focusText/personalityType change is correct, but open is the actual trigger
  }, [open]);

  async function onSend() {
    if (state.phase !== "chat" || !draft.trim() || state.isWaitingForReply) return;
    const text = draft.trim();
    const sessionId = state.session.id;
    setDraft("");
    setState({
      ...state,
      session: { ...state.session, messages: [...state.session.messages, { role: "user", content: text }] },
      isWaitingForReply: true,
    });
    try {
      const updated = await sendPracticeMessage(sessionId, text);
      setState({ phase: "chat", session: updated, isWaitingForReply: false, isEnding: false });
    } catch {
      setState({ phase: "error", message: "לא הצלחנו לשלוח את ההודעה. נסו שוב." });
    }
  }

  async function onEnd() {
    if (state.phase !== "chat" || state.isEnding || state.isWaitingForReply) return;
    const sessionId = state.session.id;
    setState({ ...state, isEnding: true });
    try {
      const outcome = await endPracticeSession(sessionId);
      setState({ phase: "feedback", sessionId, ...outcome });
    } catch {
      setState({ phase: "error", message: "לא הצלחנו לסיים את התרגול. נסו שוב." });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          {state.phase === "starting" && (
            <>
              <Dialog.Title className="sr-only">תרגול</Dialog.Title>
              <p role="status" aria-live="polite" className="text-sm text-zinc-400">
                מתחילים תרגול...
              </p>
            </>
          )}

          {state.phase === "error" && (
            <>
              <Dialog.Title className="sr-only">שגיאה בתרגול</Dialog.Title>
              <p role="alert" className="text-sm text-score-low">{state.message}</p>
              <Button variant="secondary" onClick={() => onOpenChange(false)} className="mt-4">
                סגור
              </Button>
            </>
          )}

          {state.phase === "chat" && (
            <>
              <Dialog.Title className="text-lg font-semibold text-foreground">
                תרגול: {focusText}
              </Dialog.Title>

              <div
                className="mt-4 flex-1 space-y-2 overflow-y-auto"
                role="log"
                aria-live="polite"
                aria-label="שיחת תרגול"
              >
                {state.session.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "me-auto bg-accent-blue-deep text-primary-foreground"
                        : "ms-auto bg-zinc-800 text-zinc-100"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {state.isWaitingForReply && (
                  <p className="text-xs text-zinc-500">הלקוח מקליד...</p>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <label htmlFor="practice-reply" className="sr-only">
                  הקלד תגובה
                </label>
                <Input
                  id="practice-reply"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  disabled={state.isWaitingForReply || state.isEnding}
                  placeholder="הקלד תגובה..."
                  className="flex-1 text-sm"
                />
                <Button
                  onClick={onSend}
                  disabled={state.isWaitingForReply || state.isEnding || !draft.trim()}
                >
                  שלח
                </Button>
              </div>

              <Button
                variant="secondary"
                onClick={onEnd}
                disabled={state.isEnding || state.isWaitingForReply}
                className="mt-3"
              >
                {state.isEnding ? "מסיים..." : "סיים תרגול"}
              </Button>
            </>
          )}

          {state.phase === "feedback" && (
            <>
              <Dialog.Title className="text-lg font-semibold text-foreground">
                משוב על התרגול
              </Dialog.Title>

              {typeof state.feedback.score === "number" && (
                <div className="mt-3 flex items-center justify-center gap-2" dir="ltr">
                  <span
                    className={`font-mono text-4xl font-bold tabular-nums ${
                      scorecardScoreColor(state.feedback.score).text
                    }`}
                  >
                    {state.feedback.score}
                  </span>
                  <span className="text-sm text-zinc-500">/5</span>
                </div>
              )}

              <div className="mt-4 space-y-3">
                <HighlightRow tone="positive" label="מה עבד" text={state.feedback.whatWorked} />
                <HighlightRow
                  tone="negative"
                  label="מה לשפר"
                  text={state.feedback.whatToImprove}
                />
              </div>

              {/* D5 "gentle gamification" — a count, not a badge/mascot (DESIGN.md:
                  no mascots). Ordinal phrasing ("תרגול מס' N") sidesteps Hebrew
                  singular/plural agreement for the attempt count entirely. */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
                {state.streakDays > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-insight" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
                    <span>
                      רצף תרגול:{" "}
                      <span dir="ltr" className="font-mono tabular-nums text-zinc-300">
                        {state.streakDays}
                      </span>{" "}
                      {state.streakDays === 1 ? "יום" : "ימים"}
                    </span>
                  </span>
                )}
                <span>
                  תרגול מס&apos;{" "}
                  <span dir="ltr" className="font-mono tabular-nums text-zinc-300">
                    {state.attemptCount}
                  </span>{" "}
                  בנושא זה
                </span>
              </div>

              {state.attemptCount > 1 && (
                <PracticeHistory
                  analysisId={analysisId}
                  sectionKey={sectionKey}
                  excludeSessionId={state.sessionId}
                />
              )}

              <Button onClick={() => onOpenChange(false)} className="mt-6">
                סגור
              </Button>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Previous completed practices for this exact analysis+section, shown right
 * after finishing a new one (attemptCount already proved there's at least
 * one to show — see the `attemptCount > 1` gate at the call site). Fetched
 * client-side on demand rather than passed down from a parent — same reason
 * as CoachingPlan's completion state: this dialog's ancestors have no
 * server-fetched history to hand down, and this only ever needs to run once
 * a session actually completes.
 */
function PracticeHistory({
  analysisId,
  sectionKey,
  excludeSessionId,
}: {
  analysisId: string;
  sectionKey: PracticeSectionKey;
  excludeSessionId: string;
}) {
  const [history, setHistory] = useState<
    Array<{ id: string; createdAt: string; feedback: PracticeSessionOutcome["feedback"] | null }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    getPracticeHistory(analysisId, sectionKey, excludeSessionId).then((rows) => {
      if (!cancelled) setHistory(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [analysisId, sectionKey, excludeSessionId]);

  if (history.length === 0) return null;

  return (
    <div className="mt-4 max-h-40 space-y-2 overflow-y-auto border-t border-zinc-800 pt-4">
      <p className="text-xs font-medium text-zinc-400">תרגולים קודמים בנושא זה</p>
      <ul className="space-y-2">
        {history.map((session) => (
          <li key={session.id} className="rounded-lg bg-zinc-950/40 p-2.5 text-xs">
            <p dir="ltr" className="font-mono tabular-nums text-zinc-500">
              {new Date(session.createdAt).toLocaleDateString("he-IL")}
            </p>
            {session.feedback ? (
              <p className="mt-1 text-zinc-300">{session.feedback.whatToImprove}</p>
            ) : (
              <p className="mt-1 text-zinc-500">אין משוב שמור לתרגול זה</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
