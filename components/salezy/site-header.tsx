import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Logo } from "./logo";

/**
 * Persistent top bar across the app. Solid surface (no glassmorphism) with a
 * single hairline border for elevation, per the design system. The logo links
 * home.
 *
 * Server component: it reads the auth session so a signed-in user gets the
 * Logout control (and a link back to their analyses) on EVERY page, while
 * signed-out visitors on the marketing/login pages see just the wordmark.
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href={user ? "/dashboard" : "/"}
          aria-label="Salezy — דף הבית"
          className="rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </Link>

        {user && (
          <nav className="flex items-center gap-4 sm:gap-5">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-400 transition-colors hover:text-foreground"
            >
              הניתוחים שלי
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg text-sm text-zinc-400 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                התנתק
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
