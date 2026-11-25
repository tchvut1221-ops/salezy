import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ICON_STROKE_WIDTH } from "./icons";
import { Skeleton } from "./ui";

/**
 * The one header pattern every app page uses: a fixed 64px band with a single
 * hairline under it. The title sits on the start side (right, in RTL) and one
 * row of actions on the end side (left).
 *
 * The band spans the content column edge to edge and matches the sidebar's
 * brand row (same height, same surface, same hairline), so on desktop the two
 * read as one continuous top edge of the frame. Below `md` the mobile top bar
 * is that surface, so the band sits on the page background instead of
 * stacking a second surface bar. It scrolls with the page, so it never covers
 * content.
 *
 * The row has no max-width: titles and page content hang from the same start
 * edge next to the sidebar, on every page.
 */
const BAR = "border-b border-border md:bg-surface";
const ROW = "flex h-16 items-center justify-between gap-4 px-4 sm:px-6";

export function PageHeader({
  title,
  actions,
  back,
  titleAs: Title = "h1",
}: {
  title: ReactNode;
  actions?: ReactNode;
  /** Renders as an icon button before the title; the label stays as its accessible name and tooltip. */
  back?: { href: string; label: string };
  /** "p" where the page's own content already carries the h1 (the analysis report). */
  titleAs?: "h1" | "p";
}) {
  return (
    <header className={BAR}>
      <div className={ROW}>
        <div className="flex min-w-0 items-center gap-2">
          {back && (
            // RTL back — DESIGN.md: "back points right".
            <Link
              href={back.href}
              aria-label={back.label}
              title={back.label}
              className="-ms-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowRight className="h-5 w-5" strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
            </Link>
          )}
          <Title className="min-w-0 truncate text-h2 font-semibold text-foreground">{title}</Title>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** The same band for loading.tsx files, so the page does not jump when it lands. */
export function PageHeaderSkeleton({ back = false, actions = 0 }: { back?: boolean; actions?: number }) {
  return (
    <div className={BAR}>
      <div className={ROW}>
        <div className="flex min-w-0 items-center gap-2">
          {back && <Skeleton className="-ms-1 h-8 w-8" />}
          <Skeleton className="h-8 w-40" />
        </div>
        {actions > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            {Array.from({ length: actions }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-24" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
