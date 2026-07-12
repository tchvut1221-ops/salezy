"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { signOut } from "@/app/actions";
import { buttonVariants } from "./ui";

const LINKS = [
  { href: "/dashboard", label: "הניתוחים שלי" },
  { href: "/patterns", label: "דפוסים" },
] as const;

const LINK_CLASS = (isActive: boolean) =>
  `text-sm transition-colors ${
    isActive ? "font-medium text-foreground" : "text-zinc-400 hover:text-foreground"
  }`;

/**
 * Client component so it can read the current route (usePathname, for
 * active-link state) and hold the mobile menu's open/closed state — the
 * server-rendered SiteHeader stays a Server Component (it reads the auth
 * session) and just renders this in the signed-in branch.
 */
export function HeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="hidden items-center gap-4 sm:flex sm:gap-5">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className={LINK_CLASS(pathname === link.href)}
          >
            {link.label}
          </Link>
        ))}
        <Link href="/upload" className={buttonVariants({ size: "sm" })}>
          + העלאת שיחה
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "סגור תפריט" : "פתח תפריט"}
        aria-expanded={open}
        className="rounded-lg p-2 text-zinc-400 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
      >
        {open ? (
          <X className="h-5 w-5" strokeWidth={1.5} />
        ) : (
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-14 z-30 border-b border-border bg-surface px-4 py-4 sm:hidden">
          <div className="flex flex-col gap-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
                className={LINK_CLASS(pathname === link.href)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/upload"
              onClick={() => setOpen(false)}
              className={buttonVariants({ size: "sm", className: "w-full" })}
            >
              + העלאת שיחה
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-zinc-400 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                התנתק
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
