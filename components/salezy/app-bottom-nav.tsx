"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ICON_STROKE_WIDTH } from "./icons";
import { APP_NAV_ITEMS, UPLOAD_NAV_ITEM, isNavItemActive } from "./app-nav-items";

const TABS = [...APP_NAV_ITEMS, UPLOAD_NAV_ITEM];

/**
 * Mobile navigation for the authenticated app: a fixed bottom tab bar, shown
 * only below `md` (where the sidebar is hidden). Deliberately NOT a hamburger
 * overlay — the previous header menu had no focus trap, no Esc handling and no
 * scroll lock; tabs are always-visible, always-reachable, and need none of
 * that machinery.
 *
 * Two layout details that the D0 audit called out on the old FAB and that this
 * component has to get right:
 *  1. `env(safe-area-inset-bottom)` padding so the tabs clear the iOS home
 *     indicator instead of sitting under it.
 *  2. The shell reserves matching bottom padding on the content column
 *     (app/(app)/layout.tsx), so page content is never hidden behind the bar.
 *
 * It also tags <html> with `has-bottom-nav` while mounted, which globals.css
 * uses to lift the floating accessibility button above the bar (it would
 * otherwise land right on top of the middle tab on phones).
 */
export function AppBottomNav() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("has-bottom-nav");
    return () => root.classList.remove("has-bottom-nav");
  }, []);

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {TABS.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  active ? "text-primary" : "text-zinc-400"
                }`}
              >
                <Icon
                  className="h-6 w-6"
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden="true"
                />
                <span className={`text-caption ${active ? "font-medium" : ""}`}>
                  {item.tabLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
