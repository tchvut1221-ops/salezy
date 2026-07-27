import { Skeleton } from "@/components/salezy/ui";

export default function UploadLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-2xl px-4 py-8 outline-none sm:py-12"
    >
      <p className="sr-only" role="status">טוען...</p>
      <Skeleton className="h-8 w-40" />
      <div className="mt-6 h-56 w-full animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
    </main>
  );
}
