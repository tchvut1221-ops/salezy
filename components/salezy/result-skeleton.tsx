const shimmer = "animate-pulse rounded-md bg-zinc-800";

const SECTION_TITLES = ["שיחת המכירה", "Follow-up", "סגנון הלקוח", "Scorecard שלך"];

/**
 * Shimmering placeholder shaped like the real 4-section progressive-
 * disclosure layout (components/salezy/analysis-sections.tsx +
 * analysis-section.tsx), shown while an analysis is still processing. Every
 * real AnalysisSection card renders COLLAPSED by default, so this mirrors
 * the collapsed shape — title, the summary, and the footer row on its
 * hairline — not the expanded "פרטים נוספים" content, since that's not what
 * actually occupies this space on first paint. Same width as the real
 * sections (it used to be capped at max-w-3xl inside a wider column).
 */
export function ResultSkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-hidden="true">
      <CounterSkeleton />
      {SECTION_TITLES.map((title, i) => (
        <SectionSkeleton key={title} title={title} variant={i} />
      ))}
    </div>
  );
}

/** Mirrors AnalysisSections' sections-opened counter: a count and 4 segments. */
function CounterSkeleton() {
  return (
    <div className="flex items-center justify-end gap-3">
      <div className={`h-3 w-24 ${shimmer}`} />
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1 w-6 rounded-full bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors AnalysisSection's collapsed shape: `<section rounded-xl border
 * p-4 sm:p-6>`, an `<h2>` title, the summary, then the footer row on a
 * hairline. `variant` picks the summary's shape: the score gauge with its
 * four sub-score rows (section 1), an insight block (section 2), the DISC
 * headline and two quotes (section 3), a score and a verdict (section 4).
 */
function SectionSkeleton({ title, variant }: { title: string; variant: number }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
      <h2 className="text-h3 font-semibold text-foreground">{title}</h2>

      <div className="mt-4">
        {variant === 0 && (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            <div className={`h-[123px] w-52 shrink-0 rounded-t-full ${shimmer}`} />
            <div className="w-full space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <div className={`mb-2 h-4 w-full ${shimmer}`} />
                  <div className="h-1.5 rounded-full bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        )}
        {variant === 1 && <div className={`h-28 w-full rounded-lg ${shimmer}`} />}
        {variant === 2 && (
          <div className="space-y-4">
            <div className={`h-8 w-40 ${shimmer}`} />
            <div className={`h-12 w-full ${shimmer}`} />
            <div className={`h-12 w-4/5 ${shimmer}`} />
          </div>
        )}
        {variant === 3 && (
          <div className="space-y-4">
            <div className={`h-8 w-24 ${shimmer}`} />
            <div className={`h-10 w-full ${shimmer}`} />
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        <div className={`h-11 w-28 rounded-lg ${shimmer}`} />
        <div className={`h-11 w-24 rounded-lg ${shimmer}`} />
      </div>
    </section>
  );
}
