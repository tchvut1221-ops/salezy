import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeStats,
  computePersonalityDistribution,
  fetchScorePoints,
} from "@/lib/analytics";
import { fetchDashboardInsights } from "@/lib/patterns";
import { ScoreChart } from "@/components/salezy/score-chart";
import { PerformanceSummary } from "@/components/salezy/performance-summary";
import { DiscDistribution } from "@/components/salezy/disc-distribution";
import { PatternAlert } from "@/components/salezy/pattern-alert";
import { CoachingQueue } from "@/components/salezy/coaching-queue";
import {
  AnalysesList,
  type AnalysisListItem,
} from "@/components/salezy/analyses-list";
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
  const [{ data }, scorePoints, insights] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, file_name, status, created_at, scores")
      .order("created_at", { ascending: false }),
    fetchScorePoints(supabase, user.id),
    fetchDashboardInsights(supabase, user.id),
  ]);

  const analyses = (data ?? []) as AnalysisListItem[];
  const stats = computeStats(scorePoints);
  const personalityShares = computePersonalityDistribution(scorePoints);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="w-full px-4 py-8 outline-none sm:px-6 sm:py-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-bold text-foreground">דשבורד</h1>
        <Link href="/upload" className={buttonVariants()}>
          + העלאת שיחה חדשה
        </Link>
      </div>

      {/*
        The widget grid needs at least one scored call before it can say
        anything true, so it stays hidden until then — a brand-new user gets
        the empty state below instead of five cards explaining they're empty.
      */}
      {scorePoints.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <PerformanceSummary
            stats={stats}
            points={scorePoints}
            className="lg:col-span-2"
          />
          <PatternAlert insights={insights} />
          <ScoreChart points={scorePoints} className="lg:col-span-2" />
          <DiscDistribution shares={personalityShares} />
          <CoachingQueue latest={insights.latestCoaching} className="lg:col-span-3" />
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
