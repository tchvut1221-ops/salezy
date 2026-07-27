import { LayoutDashboard, TrendingUp, Upload, type LucideIcon } from "lucide-react";

/**
 * Single source of truth for the authenticated app's navigation, shared by the
 * desktop sidebar (app-sidebar.tsx) and the mobile bottom tabs
 * (app-bottom-nav.tsx) so the two can never drift apart.
 *
 * There is deliberately no separate "שיחות" destination: /dashboard IS the
 * calls list (it renders the analyses list itself), so inventing a second
 * entry for it would be a nav item pointing at a route that doesn't exist.
 */
export interface AppNavItem {
  href: string;
  /** Full label — sidebar, and the aria-label when the item renders icon-only. */
  label: string;
  /** Bottom-tab label: same word unless the full one is too wide for a tab. */
  tabLabel: string;
  icon: LucideIcon;
  /**
   * Extra path prefixes that should light this item up. /analysis/[id] is a
   * drill-down INTO the dashboard's list, so the dashboard item stays active
   * there rather than leaving the user with no highlighted section.
   */
  matchPrefixes?: string[];
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    href: "/dashboard",
    label: "דשבורד",
    tabLabel: "דשבורד",
    icon: LayoutDashboard,
    matchPrefixes: ["/analysis"],
  },
  { href: "/patterns", label: "דפוסים", tabLabel: "דפוסים", icon: TrendingUp },
];

/**
 * The upload entry is kept out of APP_NAV_ITEMS because it isn't styled as a
 * nav link: it's the primary CTA (matching the treatment the old header nav
 * gave it) in the sidebar, and the third tab on mobile.
 */
export const UPLOAD_NAV_ITEM: AppNavItem = {
  href: "/upload",
  label: "העלאת שיחה",
  tabLabel: "העלאה",
  icon: Upload,
};

export function isNavItemActive(item: AppNavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  return (item.matchPrefixes ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
