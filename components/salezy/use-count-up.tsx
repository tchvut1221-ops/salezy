"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` once, with an easeOutCubic curve.
 * Respects prefers-reduced-motion by jumping straight to the final value.
 * Shared by ScoreGauge and the Scorecard overall-score number.
 *
 * Kept in its own client-only module (not in ./ui) because ./ui is imported by
 * several Server Components (e.g. app/dashboard/page.tsx) for its plain,
 * hook-free helpers (Panel/Pill/scoreColor) — putting a hook in that file would
 * pull useState/useEffect/useRef into their module graph and fail the build.
 */
export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}
