import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPatternsData } from "@/lib/patterns";
import { PatternsView } from "@/components/salezy/patterns-view";
import { buttonVariants } from "@/components/salezy/ui";

export default async function PatternsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getPatternsData(supabase, user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
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
        <div className="mt-8 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
          <p className="font-medium text-zinc-200">עדיין אין מספיק נתונים</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
            זיהוי דפוסים דורש לפחות 3 שיחות מנותחות עם כרטיס ביצועים. יש לך כרגע{" "}
            {data.callCount} — העלה עוד {Math.max(0, 3 - data.callCount)} שיחות כדי לפתוח
            את הדף הזה.
          </p>
          <Link href="/upload" className={`mt-6 ${buttonVariants()}`}>
            העלאת שיחה נוספת
          </Link>
        </div>
      ) : (
        <PatternsView data={data} />
      )}
    </main>
  );
}
