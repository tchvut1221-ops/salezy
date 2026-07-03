export default function PatternsLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
      <div className="mt-2 h-8 w-56 animate-pulse rounded bg-zinc-800" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 w-full animate-pulse rounded-[12px] border border-zinc-800 bg-zinc-900"
          />
        ))}
      </div>
    </main>
  );
}
