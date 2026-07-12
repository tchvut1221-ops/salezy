import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "./logo";
import { HeaderNav } from "./header-nav";

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
      <div className="relative mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href={user ? "/dashboard" : "/"}
          aria-label="Salezy — דף הבית"
          className="rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </Link>

        {user && <HeaderNav />}
      </div>
    </header>
  );
}
