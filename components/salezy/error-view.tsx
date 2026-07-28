"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants, Card } from "./ui";

/**
 * The generic "something went wrong" screen, shared by the two route-group
 * error boundaries (app/(site)/error.tsx and app/(app)/error.tsx).
 *
 * Why two boundaries instead of the single app/error.tsx this replaces: an
 * error.tsx renders INSIDE its segment's layout, and since D2 the two groups
 * have different shells. One boundary at the root would have rendered inside
 * the (now chrome-less) root layout, so an error on any route would have
 * dropped the header/footer — or the sidebar — entirely. One per group keeps
 * the surrounding shell intact either way; the visible card below is
 * unchanged from the previous app/error.tsx.
 */
export function ErrorView({
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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center outline-none"
    >
      <Card className="w-full p-8">
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
      </Card>
    </main>
  );
}
