import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload, Sparkles, TrendingUp, Lock, ShieldCheck, Clock, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants, Pill } from "@/components/salezy/ui";
import { LandingDemo } from "@/components/salezy/landing-demo";
import { SiteFooter } from "@/components/salezy/site-footer";
import { RevealOnScroll } from "@/components/salezy/reveal-on-scroll";
import { AUDIO_RETENTION_DAYS } from "@/lib/retention-policy";

const HOW_IT_WORKS = [
  {
    icon: Upload,
    title: "מעלים הקלטה",
    description: "כל פורמט נפוץ, עד 50MB. ההקלטה מתומללת ומזוהה לפי דוברים אוטומטית.",
  },
  {
    icon: Sparkles,
    title: "הבינה המלאכותית מנתחת",
    description:
      "פרופיל תקשורת של הלקוח, כרטיס ציון לאיש המכירות, רגעי מפתח וצעדים הבאים — תוך דקות.",
  },
  {
    icon: TrendingUp,
    title: "משתפרים משיחה לשיחה",
    description: "עמוד דפוסים מזהה מגמות חוזרות בביצועים שלך לאורך זמן, מתוך השיחות שלך בלבד.",
  },
] as const;

const FEATURE_ROWS = [
  {
    title: "ניתוח פסיכולוגי של הלקוח",
    description:
      "זיהוי סוג התקשורת של הלקוח (DISC) מתוך אופן הדיבור בפועל — לא ניחוש כללי — עם הנחיות קונקרטיות איך לדבר איתו.",
    visual: (
      <div className="grid grid-cols-2 gap-2">
        <Pill tone="negative">משימתי</Pill>
        <Pill tone="warn">מבטא</Pill>
        <Pill tone="positive">תומך</Pill>
        <Pill tone="info">אנליטי</Pill>
      </div>
    ),
  },
  {
    title: "צעדים הבאים לפי עדיפות",
    description: "רשימת המשך מדורגת — דחוף / בקרוב / כשיהיה זמן — כדי שאף ליד לא ייפול בין הכיסאות.",
    visual: (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <Pill tone="negative">דחוף</Pill>
          <span className="text-sm text-zinc-400">לשלוח הצעת מחיר עד יום ה׳</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <Pill tone="warn">בקרוב</Pill>
          <span className="text-sm text-zinc-400">לתאם הדגמה למנהל הרכש</span>
        </div>
      </div>
    ),
  },
] as const;

const TRUST_ITEMS = [
  { icon: Lock, text: "הצפנת תעבורה (TLS) ואחסון מוצפן" },
  { icon: ShieldCheck, text: "בידוד נתונים מלא בין חשבונות (RLS)" },
  { icon: Clock, text: `מחיקת הקלטות אוטומטית אחרי ${AUDIO_RETENTION_DAYS} יום` },
  { icon: EyeOff, text: "לעולם לא מאמנים מודלים על התוכן שלך" },
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
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-start">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              Salezy
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-5xl">
              הכר את הלקוח שלך כמו שאף אחד לא הכיר
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-400 lg:mx-0">
              העלה הקלטת שיחת מכירה וקבל תמלול מלא, ניתוח פסיכולוגי של הלקוח
              וכרטיס ציון מפורט לאיש המכירות — בדקות, לא בשעות.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/login"
                className={`w-full sm:w-auto ${buttonVariants({ size: "lg" })}`}
              >
                התחל בחינם
              </Link>
            </div>
          </div>

          <LandingDemo />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-foreground">
          איך זה עובד
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <RevealOnScroll
              key={step.title}
              delayMs={i * 100}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-700 hover:bg-zinc-800/40"
            >
              <div className="flex items-center gap-2">
                <step.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <span dir="ltr" className="font-mono text-xs text-zinc-600">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {step.description}
              </p>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Feature rows — alternating, using the app's real visual language */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="space-y-10">
          {FEATURE_ROWS.map((row, i) => (
            <RevealOnScroll
              key={row.title}
              className={`grid items-center gap-8 rounded-xl border border-zinc-800 bg-zinc-900 p-8 transition-colors hover:border-zinc-700 sm:grid-cols-2 ${
                i % 2 === 1 ? "sm:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <h3 className="text-xl font-semibold text-foreground">{row.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {row.description}
                </p>
              </div>
              <div>{row.visual}</div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Trust strip — replaces unsubstantiated "customers already use this" copy
          with concrete, verifiable commitments that must stay true to the code
          (lib/retention-policy.ts, RLS migrations, docs/legal/privacy-policy.md). */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-8 sm:px-10">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_ITEMS.map((item) => (
              <div key={item.text} className="flex items-start gap-3">
                <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-score-high" strokeWidth={1.5} />
                <p className="text-sm leading-relaxed text-zinc-300">{item.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-500">
            פרטים מלאים ב
            <Link href="/privacy" className="text-primary underline underline-offset-2">
              מדיניות הפרטיות
            </Link>
            .
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

      <SiteFooter />
    </main>
  );
}
