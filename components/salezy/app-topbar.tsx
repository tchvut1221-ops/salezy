import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { Logo } from "./logo";
import { ICON_STROKE_WIDTH } from "./icons";

/**
 * Mobile-only top bar for the authenticated app (`md:hidden`): brand + sign
 * out. Navigation itself lives in the bottom tabs, and on desktop everything
 * — logo, nav, sign out — lives in the sidebar, so this bar would be pure
 * duplication there.
 *
 * Same h-14 sticky solid surface as the marketing SiteHeader, so switching
 * between the two shells doesn't shift the page down or up.
 */
export function AppTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link
          href="/dashboard"
          aria-label="Salezy — דשבורד"
          className="rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </Link>

        <form action={signOut}>
          <button
            type="submit"
            className="flex h-11 items-center gap-2 rounded-lg px-2 text-sm text-zinc-400 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut
              className="h-5 w-5"
              strokeWidth={ICON_STROKE_WIDTH}
              aria-hidden="true"
            />
            התנתקות
          </button>
        </form>
      </div>
    </header>
  );
}
