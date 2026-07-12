"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True once the ref'd element has scrolled into view, then stays true (the
 * observer disconnects on first intersection — a one-shot reveal, not a
 * repeated enter/exit toggle). Own file, not ./ui — same reason as
 * ./use-count-up: ./ui is imported by hook-free Server Components, and a
 * hook import there would force them into the client bundle.
 */
export function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}
