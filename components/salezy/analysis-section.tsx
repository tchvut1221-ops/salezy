"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "./ui";

/**
 * Progressive-disclosure card for the analysis view. Each of the 4 analysis
 * sections (sales call / follow-up / customer style / scorecard) shows only its
 * highlights up front; the full, previously-always-visible content is preserved
 * behind "פרטים נוספים" — nothing is deleted, only collapsed.
 *
 * The `details` region stays MOUNTED at all times and is toggled via the `hidden`
 * attribute rather than conditional rendering. That is deliberate: the "הורד PDF"
 * export (lib/export-pdf.ts, html2canvas over the live #analysis-content) and
 * browser print (app/analysis/[id]/print.css) both rasterize the real DOM, so
 * collapsed-but-mounted details can be force-revealed there via CSS
 * (`[data-analysis-details]`) and the exported report stays complete even while
 * the on-screen card is collapsed. Conditional rendering would drop that content
 * from the DOM and silently shrink the PDF.
 */
export interface AnalysisSectionProps {
  /** Section heading. */
  title: string;
  /** The 2-3 key highlights — always visible. ReactNode (not string[]) so scores
   *  render in JetBrains Mono / signal colors and the DISC headline keeps its style. */
  summary: ReactNode;
  /** Expanded content, hidden by default. When absent the "פרטים נוספים" toggle
   *  is not rendered (a summary-only section, e.g. a degraded legacy analysis). */
  details?: ReactNode;
  /** Part of the component API for stage 2 (Practice Loop). Stage 1 intentionally
   *  ignores it: there is no practice flow to launch yet, so "תרגל עכשיו" is always
   *  inert with a "בקרוב" tooltip. Wiring stage 2 = read this here, no call-site churn. */
  practiceEnabled?: boolean;
  /** Fires on every expand/collapse so the parent can drive the Progress Bar. */
  onOpenChange?: (open: boolean) => void;
}

export function AnalysisSection({
  title,
  summary,
  details,
  onOpenChange,
}: AnalysisSectionProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const hasDetails = Boolean(details);

  function toggle() {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>

      <div className="mt-4">{summary}</div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {hasDetails && (
          <Button
            variant="secondary"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={detailsId}
          >
            {open ? "הסתר פרטים" : "פרטים נוספים"}
          </Button>
        )}
        {/* aria-disabled (not the real `disabled` attribute) keeps the button
            hoverable so the native title tooltip shows, and keeps it in the tab
            order announced as disabled — a real disabled button suppresses both. */}
        <Button
          variant="secondary"
          aria-disabled
          title="בקרוב"
          onClick={(e) => e.preventDefault()}
          className="cursor-not-allowed opacity-50 hover:border-zinc-700 hover:text-zinc-300"
        >
          תרגל עכשיו
        </Button>
      </div>

      {hasDetails && (
        <div
          id={detailsId}
          data-analysis-details
          hidden={!open}
          className="mt-6 space-y-5 border-t border-zinc-800 pt-6"
        >
          {details}
        </div>
      )}
    </section>
  );
}
