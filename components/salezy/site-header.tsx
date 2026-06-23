import Link from "next/link";
import { Logo } from "./logo";

/**
 * Persistent top bar across the app. Solid surface (no glassmorphism) with a
 * single hairline border for elevation, per the design system. The logo links
 * home; page-level actions (sign out, new analysis) stay on their own screens.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          aria-label="Salezy — דף הבית"
          className="rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </Link>
      </div>
    </header>
  );
}
