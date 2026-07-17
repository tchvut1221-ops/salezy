export default function UploadLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <p className="sr-only" role="status">טוען...</p>
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
      <div className="mt-6 h-56 w-full animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
    </main>
  );
}
