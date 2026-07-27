import { ResultSkeleton } from "@/components/salezy/result-skeleton";

export default function AnalysisLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-8 outline-none sm:py-12"
    >
      <p className="sr-only" role="status">טוען...</p>
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
      <div className="mt-2 h-8 w-56 animate-pulse rounded bg-zinc-800" />
      <ResultSkeleton />
    </main>
  );
}
