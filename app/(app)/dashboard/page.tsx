import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeStats,
  computePersonalityDistribution,
  fetchScorePoints,
} from "@/lib/analytics";
import { fetchDashboardInsights, MIN_CALLS_FOR_PATTERN } from "@/lib/patterns";
import { hasCompletedPracticeSession } from "@/lib/practice";
import { ScoreChart } from "@/components/salezy/score-chart";
import { PerformanceSummary } from "@/components/salezy/performance-summary";
import { DiscDistribution } from "@/components/salezy/disc-distribution";
import { PatternAlert } from "@/components/salezy/pattern-alert";
import { CoachingQueue } from "@/components/salezy/coaching-queue";
import {
  AnalysesList,
  type AnalysisListItem,
} from "@/components/salezy/analyses-list";
import { OnboardingChecklist, type ChecklistStep } from "@/components/salezy/onboarding-checklist";
import { WelcomeFlow } from "@/components/salezy/welcome-flow";
import { buttonVariants, EmptyState } from "@/components/salezy/ui";

export const metadata: Metadata = { title: "דשבורד" };

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Three independent reads, one round trip's worth of latency:
  //  1. the calls list — still only the light columns, never the `result` blob
  //  2. the flat per-call score snapshots — feed the ring, the sparkline, the
  //     chart AND the personality split (all four are pure functions over it)
  //  3. the insight widgets' payload — scorecard/nextSteps/coachingActions JSON
  //     paths only; see fetchDashboardInsights for why it isn't getPatternsData
  const [{ data }, scorePoints, insights, practiced] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, file_name, status, created_at, scores")
      .order("created_at", { ascending: false }),
    fetchScorePoints(supabase, user.id),
    fetchDashboardInsights(supabase, user.id),
    hasCompletedPracticeSession(supabase, user.id),
  ]);

  const analyses = (data ?? []) as AnalysisListItem[];
  const stats = computeStats(scorePoints);
  const personalityShares = computePersonalityDistribution(scorePoints);
  const hasCompletedAnalysis = analyses.some((a) => a.status === "completed");

  // D6 onboarding checklist — 5 real, already-computed signals (no extra
  // queries beyond the one practice-session existence check above).
  const checklistSteps: ChecklistStep[] = [
    { label: "החשבון שלך נוצר", done: true },
    { label: "העלאת שיחה ראשונה", done: analyses.length > 0, href: "/upload" },
    { label: "ניתוח ראשון הושלם", done: hasCompletedAnalysis },
    { label: "תרגול ראשון עם ה-AI", done: practiced },
    {
      label: `${MIN_CALLS_FOR_PATTERN}+ שיחות מדורגות (פותח את עמוד הדפוסים)`,
      done: scorePoints.length >= MIN_CALLS_FOR_PATTERN,
      href: "/patterns",
    },
  ];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="w-full px-4 py-8 outline-none sm:px-6 sm:py-10"
    >
      {analyses.length === 0 && <WelcomeFlow />}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-bold text-foreground">דשבורד</h1>
        <Link href="/upload" className={buttonVariants()}>
          + העלאת שיחה חדשה
        </Link>
      </div>

      <div className="mt-6">
        <OnboardingChecklist steps={checklistSteps} />
      </div>

      {/*
        The widget grid needs at least one scored call before it can say
        anything true, so it stays hidden until then — a brand-new user gets
        the empty state below instead of five cards explaining they're empty.
      */}
      {scorePoints.length > 0 && (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* D7: staggered entrance (same animate-fade-up + delay pattern already
              used by analysis-sections.tsx's cards and the calls list below) — the
              wrapper carries both the animation and the grid col-span, since the
              widgets themselves only accept className for their own inner Panel. */}
          <div className="animate-fade-up md:col-span-2" style={{ animationDelay: "0ms" }}>
            <PerformanceSummary stats={stats} points={scorePoints} />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
            <PatternAlert insights={insights} />
          </div>
          <div className="animate-fade-up md:col-span-2" style={{ animationDelay: "120ms" }}>
            <ScoreChart points={scorePoints} />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "180ms" }}>
            <DiscDistribution shares={personalityShares} />
          </div>
          <div className="animate-fade-up md:col-span-2 lg:col-span-3" style={{ animationDelay: "240ms" }}>
            <CoachingQueue latest={insights.latestCoaching} />
          </div>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-h2 font-semibold text-foreground">השיחות שלך</h2>

        {analyses.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="עדיין אין לך ניתוחים — הניתוח הראשון שלך מחכה לקובץ"
            description="העלה הקלטה של שיחת מכירה ותקבל ניתוח אישיות הלקוח, ציון ביצועים מפורט וצעדים הבאים מומלצים — הכל אוטומטית, בתוך דקות."
            action={
              <Link href="/upload" className={buttonVariants()}>
                העלאת השיחה הראשונה
              </Link>
            }
          />
        ) : (
          <div className="mt-4">
            <AnalysesList analyses={analyses} />
          </div>
        )}
      </section>
    </main>
  );
}
