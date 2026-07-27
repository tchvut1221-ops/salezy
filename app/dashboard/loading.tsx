import { Skeleton } from "@/components/salezy/ui";

/**
 * Skeleton shown while the dashboard server component fetches the analyses list
 * + analytics. Mirrors the real layout (title, upload button, a few list rows)
 * so the page doesn't jump when data lands.
 */
export default function DashboardLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-4xl px-4 py-8 outline-none sm:py-12"
    >
      <p className="sr-only" role="status">טוען...</p>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-6 h-12 w-full" />

      <div className="mt-8 space-y-3">
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
    </main>
  );
}
