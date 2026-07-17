import Link from "next/link";
import { Logo } from "./logo";

/**
 * App-wide footer, rendered once from the root layout so the legal docs and
 * the accessibility statement (WCAG 2.1 AA / תקן 5568 requires it be
 * reachable from every page, not just the marketing landing) are always one
 * click away, regardless of route.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:justify-between">
        <Logo />
        <nav aria-label="קישורים משפטיים ונגישות" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            מדיניות פרטיות
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            תנאי שימוש
          </Link>
          <Link href="/dpa" className="transition-colors hover:text-foreground">
            הסכם עיבוד נתונים
          </Link>
          <Link href="/accessibility" className="transition-colors hover:text-foreground">
            הצהרת נגישות
          </Link>
        </nav>
        <p dir="ltr" className="font-mono text-xs tabular-nums text-zinc-600">
          © {new Date().getFullYear()} Salezy
        </p>
      </div>
    </footer>
  );
}
