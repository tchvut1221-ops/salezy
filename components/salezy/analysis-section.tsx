"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./ui";
import { ICON_STROKE_WIDTH } from "./icons";

/**
 * One card per section, with internal dividers (DESIGN.md: no "card soup").
 * The details are built from Panels, each a card of its own elsewhere in the
 * app; inside an opened section they drop their border, radius, surface and
 * padding, sit 24px apart on a hairline, and their titles step down to 16px
 * so the section title (18px) stays the heading. Written as child selectors
 * here rather than a Panel option, so Panel (ui.tsx) is unchanged for every
 * other caller.
 */
const NESTED_PANELS_FLAT = [
  "[&>section]:rounded-none",
  "[&>section]:border-0",
  "[&>section]:bg-transparent",
  "[&>section]:p-0",
  "[&>section+section]:border-t",
  "[&>section+section]:pt-6",
  "[&>section>div:first-child>h2]:text-body",
].join(" ");

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
  /** Stage 2 (Practice Loop): whether this section actually has something to
   *  practice (e.g. a legacy analysis with no weeklyFocus has nothing for the
   *  Follow-up section). When false, "תרגל עכשיו" stays inert — see the
   *  disabled-button copy below for why the tooltip says "not enough data
   *  in THIS call", not "coming soon" (D0 audit: the old "בקרוב" wording
   *  implied the whole Practice Loop feature wasn't shipped yet, when it's
   *  actually live — it's just this specific legacy analysis missing the
   *  underlying v2 field this section would practice). */
  practiceEnabled?: boolean;
  /** Fires when "תרגל עכשיו" is clicked while practiceEnabled is true. The
   *  parent (AnalysisSections) owns the actual PracticeDialog instance. */
  onPracticeClick?: () => void;
  /** Fires on every expand/collapse so the parent can drive the Progress Bar. */
  onOpenChange?: (open: boolean) => void;
}

export function AnalysisSection({
  title,
  summary,
  details,
  practiceEnabled = false,
  onPracticeClick,
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
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
      <h2 className="text-h3 font-semibold text-foreground">{title}</h2>

      <div className="mt-4">{summary}</div>

      {/* Footer on a hairline: the disclosure is a quiet ghost control with a
          chevron, the practice action the one bordered button. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        {hasDetails && (
          // cn() (tailwind-merge), not Button's className slot: px-0 has to
          // replace the recipe's px-4 so the label lines up with the card's
          // text edge, and cva only concatenates (same reason as the sidebar).
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={detailsId}
            className={cn(buttonVariants({ variant: "ghost" }), "gap-2 px-0")}
          >
            {open ? "הסתר פרטים" : "פרטים נוספים"}
            {open ? (
              <ChevronUp className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            )}
          </button>
        )}
        {practiceEnabled ? (
          <Button variant="secondary" onClick={onPracticeClick}>
            תרגל עכשיו
          </Button>
        ) : (
          // aria-disabled (not the real `disabled` attribute) keeps the button
          // hoverable so the native title tooltip shows, and keeps it in the tab
          // order announced as disabled — a real disabled button suppresses both.
          <Button
            variant="secondary"
            aria-disabled
            title="אין מספיק נתונים בניתוח הזה כדי לתרגל את הקטע הזה"
            onClick={(e) => e.preventDefault()}
            className="cursor-not-allowed opacity-50 hover:border-zinc-700 hover:text-zinc-300"
          >
            תרגל עכשיו
          </Button>
        )}
      </div>

      {hasDetails && (
        <div
          id={detailsId}
          data-analysis-details
          hidden={!open}
          className={`mt-6 space-y-6 border-t border-zinc-800 pt-6 ${NESTED_PANELS_FLAT}`}
        >
          {details}
        </div>
      )}
    </section>
  );
}
