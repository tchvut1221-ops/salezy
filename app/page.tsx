import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/salezy/ui";

const FEATURES = [
  {
    title: "ניתוח אישיות הלקוח",
    description:
      "Salezy מזהה את סוג האישיות של הלקוח (אנליטי, דומיננטי, חברותי או אקספרסיבי) ומסביר איך לדבר איתו — כדי שתתאים את הגישה שלך בזמן אמת, לא בדיעבד.",
  },
  {
    title: "ציון ביצועים לכל שיחה",
    description:
      "ציון כולל ועוד ארבעה מדדים — חשיפת צרכים, טיפול בהתנגדויות, יחס הקשבה וסגירה — כדי שתדע בדיוק איפה השיחה הצליחה ואיפה היא נתקעה.",
  },
  {
    title: "צעדים הבאים מבוססי AI",
    description:
      "אחרי כל שיחה תקבל רשימת משימות מסודרת לפי דחיפות — מה לעשות עכשיו, מה אפשר לדחות, ולמה — כך שאף ליד לא נופל בין הכיסאות.",
  },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
        <p className="text-sm font-medium uppercase tracking-wider text-primary">
          Salezy
        </p>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-5xl">
          הכר את הלקוח שלך כמו שאף אחד לא הכיר
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
          העלה הקלטה של שיחת מכירה וקבל תמלול מלא, ניתוח פסיכולוגי של הלקוח
          וציון ביצועים מפורט לאיש המכירות — בדקות, לא בשעות.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className={`w-full sm:w-auto ${buttonVariants({ size: "lg" })}`}
          >
            התחל בחינם
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-700"
            >
              <h2 className="text-lg font-semibold text-foreground">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-10 text-center">
          <p className="text-lg leading-relaxed text-zinc-200">
            מנהלי מכירות כבר משתמשים ב-Salezy לשיפור הביצועים של הצוות שלהם —
            ניתוח אובייקטיבי לכל שיחה, בלי להאזין שעות להקלטות.
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-foreground">
          מוכנים להבין מה קורה בשיחות שלכם?
        </h2>
        <div className="mt-6">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            התחל בחינם
          </Link>
        </div>
      </section>
    </main>
  );
}
