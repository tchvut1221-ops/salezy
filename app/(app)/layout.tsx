import { AppSidebar } from "@/components/salezy/app-sidebar";
import { AppTopBar } from "@/components/salezy/app-topbar";
import { AppBottomNav } from "@/components/salezy/app-bottom-nav";
import { SiteFooter } from "@/components/salezy/site-footer";

/**
 * Shell for the authenticated app — /dashboard, /analysis/[id], /patterns,
 * /upload. Route groups don't affect URLs, so all four keep their paths; the
 * group exists purely so these routes get the sidebar shell while the public
 * pages keep the plain top bar (app/(site)/layout.tsx).
 *
 * Layout: a flex row capped at --container-app (1400px, the D1 token this is
 * the intended first consumer of). The sidebar is the row's FIRST child, which
 * under `dir="rtl"` puts it on the right — no physical positioning anywhere.
 * Below `md` the sidebar hides and AppBottomNav takes over.
 *
 * The `pb-[...]` on the content column reserves exactly the bottom tab bar's
 * height (h-16) plus the safe-area inset, so nothing on any app page can end
 * up underneath the tabs. It's dropped at `md`, where the bar isn't rendered.
 *
 * The footer stays inside this shell: WCAG 2.1 AA / תקן ישראלי 5568 wants the
 * accessibility statement and the legal docs reachable from every page, and
 * they only live in SiteFooter.
 *
 * No auth check here — each page already redirects to /login when there's no
 * session, so a session read in the layout would just be a second, redundant
 * round trip on every app navigation.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-app flex-1">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <AppTopBar />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </div>

      <AppBottomNav />
    </div>
  );
}
