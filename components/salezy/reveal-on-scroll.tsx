"use client";

import type { ReactNode } from "react";
import { useInView } from "./use-in-view";

/**
 * Wraps any content in a scroll-triggered fade-up (components/salezy/
 * use-in-view.ts + the .animate-fade-up keyframes in globals.css). A thin
 * Client Component so Server Components (e.g. app/page.tsx) can use it
 * without becoming client components themselves. Renders invisible-but-
 * present (opacity-0, no display:none) until it enters the viewport, so
 * layout/scroll height never shifts.
 */
export function RevealOnScroll({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`${className ?? ""} ${inView ? "animate-fade-up" : "opacity-0"}`}
      style={inView ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
