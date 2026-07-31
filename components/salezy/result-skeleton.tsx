const shimmer = "animate-pulse rounded-md bg-zinc-800";

const SECTION_TITLES = ["שיחת המכירה", "Follow-up", "סגנון הלקוח", "Scorecard שלך"];

/**
 * Shimmering placeholder shaped like the real 4-section progressive-
 * disclosure layout (components/salezy/analysis-sections.tsx +
 * analysis-section.tsx), shown while an analysis is still processing. Every
 * real AnalysisSection card renders COLLAPSED by default, so this mirrors
 * the collapsed shape — title, a short summary block, and the two action
 * buttons — not the expanded "פרטים נוספים" content, since that's not what
 * actually occupies this space on first paint. Reshaped from the pre-pivot
 * 6-8-card Stage B layout this used to mirror, so swapping the skeleton for
 * the real result no longer shifts layout (CLS = 0).
 */
export function ResultSkeleton() {
  return (
    <div className="mx-auto mt-8 max-w-3xl space-y-6" aria-hidden="true">
      <ProgressBarSkeleton />
      {SECTION_TITLES.map((title, i) => (
        <SectionSkeleton key={title} title={title} variant={i} />
      ))}
    </div>
  );
}

/** Mirrors AnalysisSections' own ProgressBar — starts at 0/4 opened. */
function ProgressBarSkeleton() {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <div className={`h-3 w-24 ${shimmer}`} />
        <div className={`h-3 w-20 ${shimmer}`} />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors AnalysisSection's collapsed shape exactly: `<section
 * rounded-xl border p-6>`, an `<h2>` title, the summary area, then the
 * "פרטים נוספים"/"תרגל עכשיו" button row — no expanded `details` block,
 * since a freshly-loaded card is always closed. `variant` alternates between
 * two summary shapes (a big score + two highlight lines for sections 1/4,
 * a single highlight card for sections 2/3) matching the two real summary
 * shapes in analysis-sections.tsx.
 */
function SectionSkeleton({ title, variant }: { title: string; variant: number }) {
  const isScoreVariant = variant === 0 || variant === 3;
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>

      <div className="mt-4 space-y-3">
        {isScoreVariant ? (
          <>
            <div className={`h-9 w-16 ${shimmer}`} />
            <div className={`h-4 w-full ${shimmer}`} />
            <div className={`h-4 w-4/5 ${shimmer}`} />
          </>
        ) : (
          <div className={`h-20 w-full rounded-xl ${shimmer}`} />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className={`h-10 w-28 rounded-lg ${shimmer}`} />
        <div className={`h-10 w-24 rounded-lg ${shimmer}`} />
      </div>
    </section>
  );
}
