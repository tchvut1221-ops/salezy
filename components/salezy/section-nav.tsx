"use client";

import { useActiveSection } from "./use-active-section";

export interface SectionNavItem {
  id: string;
  label: string;
}

/**
 * Scroll-spy navigation for the analysis result's sections. Two layouts in
 * one component (CSS media query, not JS): a vertical rail on xl+ screens
 * (grid places it on the *start* side automatically in RTL — the right
 * edge — since CSS Grid auto-placement follows the writing direction, no
 * manual reordering needed), and a horizontal scrollable pill row below
 * that, sitting under the sticky site header.
 */
export function SectionNav({ items }: { items: SectionNavItem[] }) {
  const ids = items.map((s) => s.id);
  const active = useActiveSection(ids);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="ניווט בין חלקי הניתוח"
      className="sticky top-[70px] z-10 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0 xl:pb-0"
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            aria-current={isActive ? "true" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-start text-sm transition-colors xl:rounded-none xl:border-e-2 xl:px-3 xl:py-2 ${
              isActive
                ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/25 xl:bg-transparent xl:border-primary xl:ring-0"
                : "text-zinc-400 hover:text-foreground xl:border-transparent"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
