import { Skeleton } from "@/components/salezy/ui";
import { PageHeaderSkeleton } from "@/components/salezy/page-header";
import { ResultSkeleton } from "@/components/salezy/result-skeleton";

export default function AnalysisLoading() {
  return (
    <main id="main-content" tabIndex={-1} className="w-full outline-none">
      <p className="sr-only" role="status">טוען...</p>
      <PageHeaderSkeleton back actions={2} />
      <div className="max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Skeleton className="h-8 w-56" />
        <ResultSkeleton />
      </div>
    </main>
  );
}
