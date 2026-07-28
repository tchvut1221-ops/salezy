"use client";

import { ErrorView } from "@/components/salezy/error-view";

/**
 * Error boundary for the public surface (landing, login, legal). Renders
 * inside app/(site)/layout.tsx, so the top bar and footer stay visible above
 * and below it — same as the pre-D2 app/error.tsx did under the root layout.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} />;
}
