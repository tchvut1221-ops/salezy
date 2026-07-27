import { Skeleton } from "@/components/salezy/ui";
import { ResultSkeleton } from "@/components/salezy/result-skeleton";

export default function AnalysisLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-8 outline-none sm:py-12"
    >
      <p className="sr-only" role="status">טוען...</p>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-56" />
      <ResultSkeleton />
    </main>
  );
}
