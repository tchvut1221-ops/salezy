"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/salezy/ui";

/**
 * Route-segment error boundary. Catches render/data errors anywhere under the
 * root layout and shows a friendly Hebrew message instead of a raw stack trace.
 * The SiteHeader (from the layout) stays visible above this. `reset` re-renders
 * the segment; the dashboard link is the safe escape hatch.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error to logs/monitoring without showing it to the user.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-xl font-bold text-foreground">משהו השתבש</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          נתקלנו בתקלה בלתי צפויה. אפשר לנסות שוב — ואם זה חוזר, חזרו לדשבורד
          ונסו שוב בעוד רגע.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset}>נסה שוב</Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
            חזרה לדשבורד
          </Link>
        </div>
      </div>
    </main>
  );
}
