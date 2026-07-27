"use client";

import { ErrorView } from "@/components/salezy/error-view";

/**
 * Error boundary for the authenticated app. Renders inside
 * app/(app)/layout.tsx, so a failed dashboard/patterns render keeps the
 * sidebar (and the mobile bottom tabs) — the user can navigate away instead
 * of landing on a chrome-less dead end. /upload and /analysis/[id] keep their
 * own more specific boundaries.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} />;
}
