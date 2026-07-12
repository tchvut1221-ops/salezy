"use client";

import { useEffect, useState } from "react";

/**
 * Scroll-spy: which of the given section ids is currently "the one being
 * read". Uses a detection band near the top of the viewport (rootMargin)
 * rather than a plain visibility check, so a short section below a tall one
 * still gets picked as active as soon as it reaches reading position instead
 * of only once it's fully on screen.
 */
export function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        // Among sections currently in the detection band, the one closest
        // to the top is "current" — matches how a reader's eye tracks down
        // the page.
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
        );
        setActive(topMost.target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
