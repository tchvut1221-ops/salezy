"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "./ui";

/**
 * The app's one confirmation modal, replacing the raw `window.confirm()` calls
 * that used to guard the two destructive analysis actions
 * (components/salezy/analysis-actions.tsx).
 *
 * Why replace a native confirm at all: it renders in the browser's chrome, so
 * it can't be RTL-correct, can't use the Hebrew font stack, can't be styled to
 * the design system, and — the practical problem — it blocks the main thread
 * and is suppressible by the browser, which makes "did the user actually
 * confirm?" a question the app can't answer. This dialog is Base UI's
 * (@base-ui/react/dialog, already a dependency and already the model used by
 * components/salezy/practice-dialog.tsx), which brings a real focus trap,
 * Esc-to-dismiss, backdrop-dismiss, `aria-modal`, and inert background content
 * for free.
 *
 * Built to be reusable from the start — this is the app's first shared confirm
 * dialog and both existing call sites differ only in copy and tone, so the
 * chrome lives here once rather than being duplicated per call site.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  tone = "danger",
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short question — what is about to happen. */
  title: string;
  /** The consequence, spelled out. Especially the irreversible part. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for irreversible/destructive actions, `neutral` for everything else. */
  tone?: "danger" | "neutral";
  /** Disables both controls while the confirmed action is in flight. */
  pending?: boolean;
  /**
   * Runs only on an explicit confirm click. The dialog closes itself first,
   * so a caller that navigates away (e.g. delete → /dashboard) can't leave a
   * modal behind on an unmounting route.
   */
  onConfirm: () => void;
}) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Places initial focus on CANCEL. For an irreversible action the safe choice
   * should be the one a stray Enter keypress hits — the one thing
   * window.confirm() got right for free, so it must not regress here.
   *
   * A callback ref, not an effect and not Base UI's own `initialFocus`, for two
   * reasons found by testing this component in a browser:
   *  - Base UI places initial focus itself only when it can attribute the open
   *    to an interaction it observed, i.e. to its own <Dialog.Trigger>. This
   *    dialog (like practice-dialog.tsx) is driven by a controlled `open` prop
   *    from the caller's own button, so Base UI sees a programmatic open and
   *    deliberately leaves focus alone — the popup mounts with its focus guards
   *    in place while document.activeElement stays outside it, which would
   *    strand a keyboard user and leave a screen reader announcing nothing.
   *  - An effect in THIS component is too early: Base UI mounts the portal's
   *    contents on a later render, so the ref is still null when a passive
   *    effect here would read it. Deferring with requestAnimationFrame would
   *    paper over that but rAF is throttled to a standstill in a backgrounded
   *    tab, so focus could simply never arrive.
   * A callback ref fires exactly when the button attaches to the DOM, whenever
   * that happens to be, and again on each reopen since Base UI unmounts the
   * popup in between.
   */
  const focusOnMount = useCallback((node: HTMLButtonElement | null) => {
    if (node) node.focus();
  }, []);

  /**
   * On close, focus returns to whatever opened the dialog — otherwise
   * dismissing would drop the user on <body> and lose their place in the page.
   * Guarded by isConnected because the confirmed action may have navigated
   * away (delete → /dashboard), unmounting that trigger.
   */
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    const previous = returnFocusRef.current;
    returnFocusRef.current = null;
    if (previous?.isConnected) previous.focus();
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        {/*
          shadow-overlay-lg is the D1 token reserved for genuinely floating
          surfaces (DESIGN.md: cards use background-step elevation, never
          shadows) — a modal over a dimmed backdrop is exactly that case.
        */}
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-overlay-lg"
        >
          <Dialog.Title className="text-h3 font-semibold text-foreground">
            {title}
          </Dialog.Title>

          {description && (
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-zinc-400">
              {description}
            </Dialog.Description>
          )}

          {/*
            Confirm first in DOM order, cancel second. Under dir="rtl" a flex
            row lays out from the right, so the primary action sits at the
            start (right) edge — matching every other button row in the app.
          */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              disabled={pending}
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
            <Button
              ref={focusOnMount}
              variant="secondary"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
