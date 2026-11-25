import { PageHeaderSkeleton } from "@/components/salezy/page-header";

export default function UploadLoading() {
  return (
    <main id="main-content" tabIndex={-1} className="w-full outline-none">
      <p className="sr-only" role="status">טוען...</p>
      <PageHeaderSkeleton />
      <div className="max-w-xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="h-56 w-full animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
      </div>
    </main>
  );
}
