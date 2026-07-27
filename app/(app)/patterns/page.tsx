import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPatternsData } from "@/lib/patterns";
import { PatternsView } from "@/components/salezy/patterns-view";
import { buttonVariants, EmptyState } from "@/components/salezy/ui";

export const metadata: Metadata = { title: "דפוסים" };

export default async function PatternsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getPatternsData(supabase, user.id);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-8 outline-none sm:py-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-foreground"
      >
        {/* RTL back — DESIGN.md: "back points right" */}
        <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        חזרה לדשבורד
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-foreground">דפוסים וזיהוי מגמות</h1>

      {!data.eligible ? (
        <EmptyState
          className="mt-8"
          title="עדיין אין מספיק נתונים"
          description={`זיהוי דפוסים דורש לפחות 3 שיחות מנותחות עם כרטיס ביצועים. יש לך כרגע ${
            data.callCount
          } — העלה עוד ${Math.max(0, 3 - data.callCount)} שיחות כדי לפתוח את הדף הזה.`}
          action={
            <Link href="/upload" className={buttonVariants()}>
              העלאת שיחה נוספת
            </Link>
          }
        />
      ) : (
        <PatternsView data={data} />
      )}
    </main>
  );
}
