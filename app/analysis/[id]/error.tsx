"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/salezy/ui";

export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-xl font-bold text-foreground">לא הצלחנו לטעון את הניתוח</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          נתקלנו בתקלה בלתי צפויה בטעינת השיחה הזו. אפשר לנסות שוב — ואם זה
          חוזר, חזרו לדשבורד.
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
