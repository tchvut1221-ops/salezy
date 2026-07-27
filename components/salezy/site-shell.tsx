import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/**
 * The marketing/auth/legal shell: top bar + content + footer. This is exactly
 * what the root layout used to render for EVERY route; D2 moved it down one
 * level so the authenticated app routes can render their own sidebar shell
 * instead (app/(app)/layout.tsx) without inheriting a second header.
 *
 * The fragment (rather than a wrapper element) is deliberate: header, content
 * and footer stay direct children of <body>, which is the flex column that
 * pins the footer to the bottom on short pages. Wrapping them would change
 * that layout.
 *
 * Two callers: app/(site)/layout.tsx (all marketing/auth/legal routes) and
 * app/not-found.tsx — the root 404 can't use a route group's layout (Next
 * renders it inside the ROOT layout), so it composes the same shell itself
 * and stays visually identical to every other page.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
