"use client";

import { useEffect, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Accessibility, Contrast, CirclePause, Minus, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";

const FONT_SCALE_KEY = "a11y-font-scale";
const HIGH_CONTRAST_KEY = "a11y-high-contrast";
const REDUCE_MOTION_KEY = "a11y-reduce-motion";

const MIN_SCALE = 1;
const MAX_SCALE = 1.5;
const SCALE_STEP = 0.1;

function applyToDocument(scale: number, highContrast: boolean, reduceMotion: boolean) {
  const root = document.documentElement;
  root.style.setProperty("--a11y-font-scale", String(scale));
  root.classList.toggle("a11y-high-contrast", highContrast);
  root.classList.toggle("a11y-reduce-motion", reduceMotion);
}

/**
 * Floating accessibility toolbar, additive to (never a replacement for) the
 * native WCAG fixes elsewhere in the app — text resize / high contrast /
 * pause animations are opt-in user preferences, persisted to localStorage,
 * applied via classes + a CSS custom property (see globals.css) so the
 * default design system is untouched unless a visitor turns one on.
 *
 * Base UI's Popover (same library as PracticeDialog's Dialog) gives real
 * focus handling / Esc-to-close / outside-dismiss for free.
 */
export function AccessibilityWidget() {
  const [scale, setScale] = useState(MIN_SCALE);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted prefs once on mount and apply them. Reading localStorage
  // during render would break SSR (no `window` on the server), so this is
  // deliberately an effect — the trade-off is a brief flash of the default
  // (unscaled/normal-contrast/animated) state before it applies, same
  // documented trade-off as this app's other client-only hydration reads.
  useEffect(() => {
    const savedScale = Number(localStorage.getItem(FONT_SCALE_KEY));
    const savedContrast = localStorage.getItem(HIGH_CONTRAST_KEY) === "1";
    const savedMotion = localStorage.getItem(REDUCE_MOTION_KEY) === "1";
    const resolvedScale =
      Number.isFinite(savedScale) && savedScale >= MIN_SCALE && savedScale <= MAX_SCALE
        ? savedScale
        : MIN_SCALE;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage (an external system unavailable during SSR/render), same justified pattern as PracticeDialog's session-reset effect.
    setScale(resolvedScale);
    setHighContrast(savedContrast);
    setReduceMotion(savedMotion);
    applyToDocument(resolvedScale, savedContrast, savedMotion);
    setHydrated(true);
  }, []);

  function updateScale(next: number) {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(next * 10) / 10));
    setScale(clamped);
    localStorage.setItem(FONT_SCALE_KEY, String(clamped));
    applyToDocument(clamped, highContrast, reduceMotion);
  }

  function toggleHighContrast() {
    const next = !highContrast;
    setHighContrast(next);
    localStorage.setItem(HIGH_CONTRAST_KEY, next ? "1" : "0");
    applyToDocument(scale, next, reduceMotion);
  }

  function toggleReduceMotion() {
    const next = !reduceMotion;
    setReduceMotion(next);
    localStorage.setItem(REDUCE_MOTION_KEY, next ? "1" : "0");
    applyToDocument(scale, highContrast, next);
  }

  function reset() {
    setScale(MIN_SCALE);
    setHighContrast(false);
    setReduceMotion(false);
    localStorage.removeItem(FONT_SCALE_KEY);
    localStorage.removeItem(HIGH_CONTRAST_KEY);
    localStorage.removeItem(REDUCE_MOTION_KEY);
    applyToDocument(MIN_SCALE, false, false);
  }

  // Avoid rendering interactive toggle state before hydration reads the
  // real persisted values, so a keyboard/AT user tabbing in immediately
  // doesn't see a control flip state out from under them.
  if (!hydrated) {
    return (
      <button
        type="button"
        aria-label="פתיחת סרגל נגישות"
        disabled
        className="fixed bottom-6 end-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500"
      >
        <Accessibility className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
      </button>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="פתיחת סרגל נגישות"
        className="fixed bottom-6 end-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-accent-blue-deep text-primary-foreground shadow-lg outline-none transition-colors hover:bg-accent-blue-deep/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Accessibility className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="end" sideOffset={12} className="z-40">
          <Popover.Popup className="w-72 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
            <Popover.Title className="text-sm font-semibold text-foreground">
              סרגל נגישות
            </Popover.Title>

            <div className="mt-4 space-y-4">
              <div>
                <span className="block text-xs text-zinc-500">גודל טקסט</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateScale(scale - SCALE_STEP)}
                    disabled={scale <= MIN_SCALE}
                    aria-label="הקטן טקסט"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 outline-none transition-colors hover:border-zinc-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span dir="ltr" className="w-12 text-center font-mono text-sm tabular-nums text-foreground">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => updateScale(scale + SCALE_STEP)}
                    disabled={scale >= MAX_SCALE}
                    aria-label="הגדל טקסט"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 outline-none transition-colors hover:border-zinc-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleHighContrast}
                aria-pressed={highContrast}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  highContrast
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-foreground"
                }`}
              >
                <Contrast className="h-4 w-4 shrink-0" aria-hidden="true" />
                ניגודיות גבוהה
              </button>

              <button
                type="button"
                onClick={toggleReduceMotion}
                aria-pressed={reduceMotion}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  reduceMotion
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-foreground"
                }`}
              >
                <CirclePause className="h-4 w-4 shrink-0" aria-hidden="true" />
                עצירת אנימציות
              </button>

              <button
                type="button"
                onClick={reset}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-400 outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                איפוס
              </button>

              <Link
                href="/accessibility"
                className="block text-center text-xs text-primary underline underline-offset-2"
              >
                הצהרת נגישות
              </Link>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
