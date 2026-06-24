/**
 * Skeleton shown while the dashboard server component fetches the analyses list
 * + analytics. Mirrors the real layout (title, upload button, a few list rows)
 * so the page doesn't jump when data lands.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
      <div className="mt-6 h-12 w-full animate-pulse rounded-lg bg-zinc-800" />

      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 sm:px-5 sm:py-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
            </div>
            <div className="h-6 w-8 animate-pulse rounded bg-zinc-800" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
