import { ResultSkeleton } from "@/components/salezy/result-skeleton";

export default function AnalysisLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
      <div className="mt-2 h-8 w-56 animate-pulse rounded bg-zinc-800" />
      <ResultSkeleton />
    </main>
  );
}
