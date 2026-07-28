"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Upload, Brain, TrendingUp } from "lucide-react";
import { Button } from "./ui";
import { ICON_STROKE_WIDTH } from "./icons";

const STEPS = [
  {
    icon: Upload,
    title: "מעלים הקלטת שיחה",
    body: "כל פורמט נפוץ, עד 50MB. ההקלטה מתומללת ומזוהה לפי דוברים אוטומטית — לא צריך לערוך כלום מראש.",
  },
  {
    icon: Brain,
    title: "מקבלים ניתוח מלא",
    body: "פרופיל תקשורת של הלקוח (DISC), כרטיס ציון לאיש המכירות מבוסס ציטוטים, ורגעי מפתח מהשיחה — תוך דקות.",
  },
  {
    icon: TrendingUp,
    title: "משתפרים משיחה לשיחה",
    body: "עמוד דפוסים מזהה מגמות חוזרות בביצועים שלך, ותרגול AI נותן לך מקום לתרגל בדיוק את מה שצריך לפני השיחה הבאה.",
  },
] as const;

const DISMISSED_KEY = "salezy-welcome-seen";

/**
 * D6 welcome flow — 3 steps, shown once to a brand-new user (dashboard.tsx
 * only mounts this when the user has zero analyses yet), dismissed
 * permanently via localStorage the same way accessibility-widget.tsx
 * persists its own preferences. Not a wizard collecting input — purely
 * orientation, so there's no server round trip and no data to lose by
 * closing early; the "דלג" escape hatch is always available for exactly
 * that reason.
 */
export function WelcomeFlow() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  // Starts closed (SSR-safe — localStorage doesn't exist on the server) and
  // opens after a one-time read, same documented trade-off as
  // accessibility-widget.tsx: a user who's already dismissed this sees
  // nothing extra; a first-time visitor sees it appear a frame after paint
  // rather than flash-then-vanish.
  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) !== "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage, unavailable during SSR (same pattern as accessibility-widget.tsx / app-sidebar.tsx).
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  }

  // Initial focus on the primary action, for the same reason ConfirmDialog
  // does this via a callback ref rather than an effect or Base UI's own
  // initialFocus — this dialog opens from a controlled `open` state Base UI
  // didn't itself attribute to a trigger click, so it won't auto-focus.
  const focusOnMount = useCallback((node: HTMLButtonElement | null) => {
    if (node) node.focus();
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && dismiss()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-overlay-lg">
          <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-zinc-700"
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-6 w-6 text-primary" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            </span>
          </div>

          <Dialog.Title className="mt-4 text-center text-h3 font-semibold text-foreground">
            {current.title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-center text-sm leading-relaxed text-zinc-400">
            {current.body}
          </Dialog.Description>

          <p className="sr-only" role="status" aria-live="polite">
            {`שלב ${step + 1} מתוך ${STEPS.length}`}
          </p>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={dismiss}>
              דלג
            </Button>
            <Button
              ref={focusOnMount}
              onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
            >
              {isLast ? "בואו נתחיל" : "הבא"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
