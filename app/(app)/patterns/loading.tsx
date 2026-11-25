import { PageHeaderSkeleton } from "@/components/salezy/page-header";

export default function PatternsLoading() {
  return (
    <main id="main-content" tabIndex={-1} className="w-full outline-none">
      <p className="sr-only" role="status">טוען...</p>
      <PageHeaderSkeleton back />
      <div className="max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 w-full animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
          />
        ))}
      </div>
    </main>
  );
}
