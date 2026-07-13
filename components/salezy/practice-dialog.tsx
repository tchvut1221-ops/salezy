"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "./ui";
import { HighlightRow } from "./analysis-sections";
import {
  startPracticeSession,
  sendPracticeMessage,
  endPracticeSession,
} from "@/app/actions";
import type {
  PracticeSectionKey,
  PracticeSession,
  PracticeFeedback,
  PersonalityType,
} from "@/types";

type DialogState =
  | { phase: "starting" }
  | { phase: "chat"; session: PracticeSession; isWaitingForReply: boolean; isEnding: boolean }
  | { phase: "feedback"; feedback: PracticeFeedback }
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
    setState({ phase: "starting" });
    setDraft("");
    startPracticeSession(analysisId, sectionKey, focusText, personalityType)
      .then((session) =>
        setState({ phase: "chat", session, isWaitingForReply: false, isEnding: false })
      )
      .catch(() =>
        setState({ phase: "error", message: "לא הצלחנו להתחיל את התרגול. נסו שוב." })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on analysisId/sectionKey/focusText/personalityType change is correct, but open is the actual trigger
  }, [open]);

  async function onSend() {
    if (state.phase !== "chat" || !draft.trim() || state.isWaitingForReply) return;
    const text = draft.trim();
    const sessionId = state.session.id;
    setDraft("");
    setState({ ...state, isWaitingForReply: true });
    try {
      const updated = await sendPracticeMessage(sessionId, text);
      setState({ phase: "chat", session: updated, isWaitingForReply: false, isEnding: false });
    } catch {
      setState({ phase: "error", message: "לא הצלחנו לשלוח את ההודעה. נסו שוב." });
    }
  }

  async function onEnd() {
    if (state.phase !== "chat" || state.isEnding) return;
    const sessionId = state.session.id;
    setState({ ...state, isEnding: true });
    try {
      const feedback = await endPracticeSession(sessionId);
      setState({ phase: "feedback", feedback });
    } catch {
      setState({ phase: "error", message: "לא הצלחנו לסיים את התרגול. נסו שוב." });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Popup className="fixed start-1/2 top-1/2 z-50 flex max-h-[80vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          {state.phase === "starting" && (
            <p className="text-sm text-zinc-400">מתחילים תרגול...</p>
          )}

          {state.phase === "error" && (
            <>
              <p className="text-sm text-score-low">{state.message}</p>
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

              <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
                {state.session.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "ms-auto bg-primary text-primary-foreground"
                        : "me-auto bg-zinc-800 text-zinc-100"
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
                <input
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
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-foreground placeholder:text-zinc-600"
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
                disabled={state.isEnding}
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
              <div className="mt-4 space-y-3">
                <HighlightRow tone="positive" label="מה עבד" text={state.feedback.whatWorked} />
                <HighlightRow
                  tone="negative"
                  label="מה לשפר"
                  text={state.feedback.whatToImprove}
                />
              </div>
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
