import { Skeleton } from "@/components/salezy/ui";

/** Same shell as a real Panel, so the skeleton grid occupies the real grid's box. */
function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900 p-6 ${className ?? ""}`}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-5 w-36" />
      <Skeleton className="mt-6 h-32 w-full" />
    </div>
  );
}

/**
 * Skeleton shown while the dashboard server component fetches the analyses
 * list + analytics + insights.
 *
 * It mirrors the real page's GRID, not just its list: the previous version
 * skeletoned only the title, the CTA and four list rows, so when the stats and
 * chart landed the list was shoved hundreds of pixels down the page — a
 * measurable layout shift flagged by the D0 audit, and with five widgets
 * instead of two it would have been considerably worse. The placeholders below
 * carry the same column spans and roughly the same heights as the widgets they
 * stand in for.
 */
export default function DashboardLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="w-full px-4 py-8 outline-none sm:px-6 sm:py-10"
    >
      <p className="sr-only" role="status">
        טוען...
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-11 w-44" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <PanelSkeleton className="lg:col-span-2" />
        <PanelSkeleton />
        <PanelSkeleton className="lg:col-span-2" />
        <PanelSkeleton />
        <PanelSkeleton className="lg:col-span-3" />
      </div>

      <div className="mt-10">
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 sm:px-5 sm:py-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-8" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
