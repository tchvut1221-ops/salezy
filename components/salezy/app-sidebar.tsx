"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { Logo } from "./logo";
import { ICON_STROKE_WIDTH } from "./icons";
import {
  APP_NAV_ITEMS,
  UPLOAD_NAV_ITEM,
  isNavItemActive,
  type AppNavItem,
} from "./app-nav-items";

const COLLAPSED_KEY = "salezy-sidebar-collapsed";

/** Nav groups, in the same order as the mobile tabs. */
const NAV_GROUPS: { label: string; items: AppNavItem[] }[] = [
  { label: "סקירה", items: APP_NAV_ITEMS },
  { label: "פעולות", items: [UPLOAD_NAV_ITEM] },
];
const ACCOUNT_LABEL = "חשבון";

/** Every row in the sidebar: 44px tall, accent focus ring, visible hover. */
const ROW =
  "relative flex h-11 items-center gap-3 rounded-lg text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
const ROW_IDLE = "text-zinc-400 hover:bg-hover hover:text-foreground";
/* Active: a solid accent bar on the start edge plus a raised surface, so the
   current page reads at a glance and not only through a text colour. */
const ROW_ACTIVE =
  "bg-elevated font-medium text-foreground before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-e-full before:bg-primary";
const GROUP_LABEL = "px-3 pb-1 text-caption font-medium text-zinc-500";

/**
 * Desktop sidebar for the authenticated app (md and up — below that the
 * bottom tab bar takes over, see app-bottom-nav.tsx). 240px expanded / 64px
 * collapsed to icons, with the choice persisted to localStorage the same way
 * accessibility-widget.tsx persists its preferences.
 *
 * It is the frame's own surface, one step above the page background, with a
 * strong edge toward the content. Its brand row is the same 64px band with the
 * same hairline as the PageHeader beside it. Collapsed, the group labels give
 * way to hairlines so the grouping still shows.
 *
 * RTL: the sidebar is the first child of the shell's flex row, so it lands on
 * the start (right) edge, and its edge is `border-e` (the end/left side in
 * RTL). No physical left/right classes anywhere in this file.
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

  const rowPadding = collapsed ? "justify-center px-0" : "px-3";

  return (
    <aside
      className={`sticky top-0 hidden h-svh shrink-0 flex-col overflow-y-auto border-e border-border-strong bg-surface transition-[width] duration-200 md:flex ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div
        className={`flex h-16 shrink-0 items-center border-b border-border ${
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
        className={`flex flex-col gap-6 py-4 ${collapsed ? "px-2" : "px-3"}`}
      >
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label} role="group" aria-label={group.label} className="flex flex-col gap-1">
            {collapsed ? (
              index > 0 && <div className="mx-2 mb-2 border-t border-border" aria-hidden="true" />
            ) : (
              <p className={GROUP_LABEL} aria-hidden="true">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = isNavItemActive(item, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`${ROW} ${rowPadding} ${active ? ROW_ACTIVE : ROW_IDLE}`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`}
                    strokeWidth={ICON_STROKE_WIDTH}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        role="group"
        aria-label={ACCOUNT_LABEL}
        className={`mt-auto flex flex-col gap-1 border-t border-border py-3 ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
        {!collapsed && (
          <p className={GROUP_LABEL} aria-hidden="true">
            {ACCOUNT_LABEL}
          </p>
        )}
        <button
          type="button"
          onClick={toggle}
          // No aria-expanded/aria-controls: the nav itself is never hidden
          // (only its labels are), so claiming a collapsed region would be a
          // lie to a screen reader. The state-specific label carries the
          // meaning instead.
          aria-label={collapsed ? "הרחבת תפריט הצד" : "כיווץ תפריט הצד"}
          className={`${ROW} ${rowPadding} ${ROW_IDLE}`}
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
            className={`${ROW} w-full ${rowPadding} ${ROW_IDLE}`}
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
