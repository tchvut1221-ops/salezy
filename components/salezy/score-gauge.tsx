"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, scoreColor } from "./ui";

type SubScores = {
  needsDiscovery: number;
  objectionHandling: number;
  listeningRatio: number;
  closing: number;
};

const SUBSCORES: { key: keyof SubScores; label: string }[] = [
  { key: "needsDiscovery", label: "חשיפת צרכים" },
  { key: "objectionHandling", label: "טיפול בהתנגדויות" },
  { key: "listeningRatio", label: "יחס הקשבה" },
  { key: "closing", label: "סגירה" },
];

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Animates a number from 0 to `target` once, with an easeOutCubic curve (calm,
 * no overshoot/bounce). Respects prefers-reduced-motion by jumping straight to
 * the final value.
 */
function useCountUp(target: number, duration = 800) {
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

/**
 * The signature element: a semicircular gauge for the overall call score, with the
 * four sub-scores as compact meters beside it. The dial reads as a performance
 * meter — the natural instrument for "how did this call go". The arc and the
 * center number count up together on mount.
 */
export function ScoreGauge({
  overall,
  scores,
}: {
  overall: number;
  scores?: SubScores;
}) {
  const value = clamp(overall);
  const display = useCountUp(value);
  const c = scoreColor(value); // color keyed to the final score, not the in-flight value
  const r = 80;
  const len = Math.PI * r; // length of the 180° arc
  const offset = len * (1 - display / 100);

  return (
    <Panel title="ציון השיחה">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        {/* Gauge — kept LTR; a dial is an instrument, not text. */}
        <div className="relative shrink-0" dir="ltr">
          <svg
            viewBox="0 0 200 118"
            className="w-52"
            role="img"
            aria-label={`ציון כולל ${Math.round(value)} מתוך 100`}
          >
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#2A2A3D"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={c.stroke}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <span
              className={`font-mono text-5xl font-bold tabular-nums sm:text-6xl ${c.text}`}
            >
              {Math.round(display)}
            </span>
            <span className="text-xs text-zinc-500">מתוך 100</span>
          </div>
        </div>

        {scores && (
          <div className="w-full space-y-3">
            {SUBSCORES.map(({ key, label }) => {
              const v = clamp(scores[key] ?? 0);
              const sc = scoreColor(v);
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{label}</span>
                    <span className={`font-mono tabular-nums ${sc.text}`}>
                      {Math.round(v)}
                    </span>
                  </div>
                  {/* Track + fill anchored to the trailing edge so it grows RTL. */}
                  <div className="relative h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`absolute inset-y-0 end-0 rounded-full transition-[width] duration-700 ease-out ${sc.bar}`}
                      style={{ width: `${v}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
