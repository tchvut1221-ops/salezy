"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants, Card } from "@/components/salezy/ui";

export default function UploadError({
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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center outline-none"
    >
      <Card className="w-full p-8">
        <h1 className="text-xl font-bold text-foreground">לא הצלחנו לטעון את מסך ההעלאה</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          נתקלנו בתקלה בלתי צפויה. אפשר לנסות שוב — ואם זה חוזר, חזרו לדשבורד.
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
