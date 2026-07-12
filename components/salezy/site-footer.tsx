import Link from "next/link";
import { Logo } from "./logo";

/**
 * Marketing-page footer — landing only (not the authenticated app shell,
 * which stays dense per DESIGN.md and doesn't need repeated legal links on
 * every screen). Surfaces the legal docs from app/(legal)/*.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:justify-between">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            מדיניות פרטיות
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            תנאי שימוש
          </Link>
          <Link href="/dpa" className="transition-colors hover:text-foreground">
            הסכם עיבוד נתונים
          </Link>
        </nav>
        <p dir="ltr" className="font-mono text-xs tabular-nums text-zinc-600">
          © {new Date().getFullYear()} Salezy
        </p>
      </div>
    </footer>
  );
}
