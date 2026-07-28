import Link from "next/link";
import { buttonVariants, Card } from "@/components/salezy/ui";
import { SiteShell } from "@/components/salezy/site-shell";

/**
 * 404 page. Reached for unknown routes and for `notFound()` (e.g. an analysis
 * id that doesn't exist or isn't visible to this user under RLS). Friendly
 * Hebrew copy + a clear way back, never a bare Next.js 404.
 *
 * Wraps itself in SiteShell: Next renders the root not-found inside the ROOT
 * layout, which since D2 carries no header/footer of its own — so this page
 * composes the same top-bar + footer shell the route groups get from their
 * layouts, and renders exactly as it did before.
 */
export default function NotFound() {
  return (
    <SiteShell>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center outline-none"
      >
        <Card className="w-full p-8">
          <p className="font-mono text-5xl font-bold tabular-nums text-zinc-600">
            404
          </p>
          <h1 className="mt-4 text-xl font-bold text-foreground">
            הדף לא נמצא
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            הקישור שגוי, או שהניתוח שחיפשת לא קיים או אינו שייך לחשבון שלך.
          </p>
          <Link href="/dashboard" className={`mt-6 ${buttonVariants()}`}>
            חזרה לדשבורד
          </Link>
        </Card>
      </main>
    </SiteShell>
  );
}
