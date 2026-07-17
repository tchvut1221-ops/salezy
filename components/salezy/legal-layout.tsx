import type { ReactNode } from "react";
import { LEGAL_DOCS_UPDATED_AT } from "@/lib/legal";

/**
 * Shared shell for the legal pages (privacy/terms/DPA): draft banner,
 * title, version/date line, and the `.legal-prose`-scoped content area
 * (styled in globals.css). Children are plain semantic HTML (h2/p/ul/table).
 */
export function LegalLayout({
  title,
  version,
  updatedAt,
  children,
}: {
  title: string;
  version: string;
  /** Overrides the shared privacy/terms/DPA date stamp — needed for documents (e.g. the accessibility statement) versioned independently of lib/legal.ts. */
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 outline-none sm:py-14">
      <div className="rounded-lg border border-score-mid/30 bg-score-mid/10 px-4 py-3 text-sm text-score-mid">
        טיוטה — טעון בדיקת עורך/ת דין לפני פרסום.
      </div>

      <h1 className="mt-6 text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
      <p className="mt-1 text-xs text-zinc-500">
        גרסה {version} · עדכון אחרון: {updatedAt ?? LEGAL_DOCS_UPDATED_AT}
      </p>

      <div className="legal-prose">{children}</div>
    </main>
  );
}

/** Inline flag on a clause that needs a lawyer's decision before publication — not a stylistic aside. */
export function LawyerNote({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-score-mid"> ({children} — לבדיקת עו״ד) </strong>;
}
