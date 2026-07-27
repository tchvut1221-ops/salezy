import { SiteShell } from "@/components/salezy/site-shell";

/**
 * Shell for the public surface — landing, login, legal docs, accessibility
 * statement. Identical markup to what the root layout rendered for every
 * route before D2 (top bar + content + footer), just scoped to this route
 * group so the authenticated app (app/(app)) can render a sidebar shell
 * instead. Route groups don't affect URLs: /, /login, /privacy, /terms,
 * /dpa and /accessibility all keep their paths.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}
