"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { buttonVariants } from "./ui";
import { ICON_STROKE_WIDTH } from "./icons";
import { APP_NAV_ITEMS, UPLOAD_NAV_ITEM, isNavItemActive } from "./app-nav-items";

const COLLAPSED_KEY = "salezy-sidebar-collapsed";

/**
 * Desktop sidebar for the authenticated app (md and up — below that the
 * bottom tab bar takes over, see app-bottom-nav.tsx). 240px expanded / 64px
 * collapsed to icons, with the choice persisted to localStorage the same way
 * accessibility-widget.tsx persists its preferences.
 *
 * RTL: the sidebar is the first child of the shell's flex row, so it lands on
 * the start (right) edge, and its inner divider is `border-e` (the end/left
 * side in RTL). No physical left/right classes anywhere in this file.
 *
 * Every hit target is h-11 (44px) — the D0 audit flagged sub-24px controls in
 * the old nav, so nothing here goes below the 44px comfortable minimum.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // localStorage isn't readable during SSR/render, so (like the accessibility
  // widget) this is a one-time hydration read. The trade-off is that a user
  // who prefers the collapsed sidebar sees it expanded for one frame; the
  // width transition below makes that read as a deliberate animation rather
  // than a glitch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage, unavailable during SSR.
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-0 hidden h-svh shrink-0 flex-col overflow-y-auto border-e border-border bg-surface transition-[width] duration-200 md:flex ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div
        className={`flex h-14 shrink-0 items-center ${
          collapsed ? "justify-center px-2" : "px-4"
        }`}
      >
        <Link
          href="/dashboard"
          aria-label="Salezy — דשבורד"
          className={`flex h-11 items-center rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring ${
            collapsed ? "w-11 justify-center" : ""
          }`}
        >
          <Logo size={collapsed ? "sm" : "md"} withWordmark={!collapsed} />
        </Link>
      </div>

      {/* Tighter horizontal padding when collapsed so each icon target is 48px
          wide rather than 40 — comfortably past the 24px WCAG floor. */}
      <nav
        aria-label="ניווט ראשי"
        className={`mt-4 flex flex-col gap-1 ${collapsed ? "px-2" : "px-3"}`}
      >
        {APP_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={`flex h-11 items-center gap-3 rounded-lg text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-zinc-400 hover:bg-hover hover:text-foreground"
              }`}
            >
              <Icon
                className="h-5 w-5 shrink-0"
                strokeWidth={ICON_STROKE_WIDTH}
                aria-hidden="true"
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        <Link
          href={UPLOAD_NAV_ITEM.href}
          aria-label={collapsed ? UPLOAD_NAV_ITEM.label : undefined}
          title={collapsed ? UPLOAD_NAV_ITEM.label : undefined}
          // cn() (tailwind-merge), not buttonVariants' own className slot: the
          // collapsed pill has to override the recipe's px-4 with px-0, and
          // cva only concatenates — leaving both classes in play and the
          // outcome up to stylesheet order.
          className={cn(
            buttonVariants(),
            "mt-2 h-11 gap-2",
            collapsed ? "w-11 self-center px-0" : "w-full"
          )}
        >
          <UPLOAD_NAV_ITEM.icon
            className="h-5 w-5 shrink-0"
            strokeWidth={ICON_STROKE_WIDTH}
            aria-hidden="true"
          />
          {!collapsed && <span className="text-sm">{UPLOAD_NAV_ITEM.label}</span>}
        </Link>
      </nav>

      <div
        className={`mt-auto flex flex-col gap-1 py-3 ${collapsed ? "px-2" : "px-3"}`}
      >
        <button
          type="button"
          onClick={toggle}
          // No aria-expanded/aria-controls: the nav itself is never hidden
          // (only its labels are), so claiming a collapsed region would be a
          // lie to a screen reader. The state-specific label carries the
          // meaning instead.
          aria-label={collapsed ? "הרחבת תפריט הצד" : "כיווץ תפריט הצד"}
          className={`flex h-11 items-center gap-3 rounded-lg text-sm text-zinc-400 outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          {/* RTL: the sidebar sits on the right, so "collapse" pushes it toward
              the right edge (ChevronsRight) and "expand" pulls it back toward
              the content on the left (ChevronsLeft) — DESIGN.md's mirroring rule. */}
          {collapsed ? (
            <ChevronsLeft
              className="h-5 w-5 shrink-0"
              strokeWidth={ICON_STROKE_WIDTH}
              aria-hidden="true"
            />
          ) : (
            <ChevronsRight
              className="h-5 w-5 shrink-0"
              strokeWidth={ICON_STROKE_WIDTH}
              aria-hidden="true"
            />
          )}
          {!collapsed && <span className="truncate">כיווץ תפריט</span>}
        </button>

        <form action={signOut}>
          <button
            type="submit"
            aria-label={collapsed ? "התנתקות" : undefined}
            title={collapsed ? "התנתקות" : undefined}
            className={`flex h-11 w-full items-center gap-3 rounded-lg text-sm text-zinc-400 outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${
              collapsed ? "justify-center px-0" : "px-3"
            }`}
          >
            <LogOut
              className="h-5 w-5 shrink-0"
              strokeWidth={ICON_STROKE_WIDTH}
              aria-hidden="true"
            />
            {!collapsed && <span className="truncate">התנתקות</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
