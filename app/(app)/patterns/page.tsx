import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPatternsData } from "@/lib/patterns";
import { PatternsView } from "@/components/salezy/patterns-view";
import { PageHeader } from "@/components/salezy/page-header";
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
    <main id="main-content" tabIndex={-1} className="w-full outline-none">
      <PageHeader title="דפוסים וזיהוי מגמות" back={{ href: "/dashboard", label: "חזרה לדשבורד" }} />

      <div className="max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {!data.eligible ? (
        <EmptyState
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
      </div>
    </main>
  );
}
