import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStats, fetchScorePoints } from "@/lib/analytics";
import { StatsBar } from "@/components/salezy/stats-bar";
import { ScoreChart } from "@/components/salezy/score-chart";
import { Pill, buttonVariants, scoreColor, EmptyState } from "@/components/salezy/ui";
import { DeleteAnalysisButton } from "@/components/salezy/analysis-actions";
import type { AnalysisStatus } from "@/types";

type AnalysisListItem = {
  id: string;
  file_name: string;
  status: AnalysisStatus;
  created_at: string;
  scores: { overall: number } | null;
};

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  uploaded: "בתור",
  converting: "ממיר קובץ",
  transcribing: "מתמלל",
  analyzing: "מנתח",
  completed: "מוכן",
  failed: "נכשל",
  no_speech_detected: "לא זוהה דיבור",
  cancelled: "בוטל",
};

// Status → Pill tone. In-progress states share the amber "warn" tone; the
// terminal states get their semantic colors.
const STATUS_TONE: Record<
  AnalysisStatus,
  "neutral" | "positive" | "negative" | "warn"
> = {
  uploaded: "neutral",
  converting: "warn",
  transcribing: "warn",
  analyzing: "warn",
  completed: "positive",
  failed: "negative",
  no_speech_detected: "negative",
  cancelled: "neutral",
};

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const metadata: Metadata = { title: "הניתוחים שלי" };

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // `created_at` (date column) and `scores` (per-row overall score) are needed
  // by the list rows now — still avoiding the full `result` jsonb. Runs
  // alongside the analytics query; neither depends on the other's result.
  const [{ data }, scorePoints] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, file_name, status, created_at, scores")
      .order("created_at", { ascending: false }),
    fetchScorePoints(supabase, user.id),
  ]);

  const analyses = (data ?? []) as AnalysisListItem[];
  const stats = computeStats(scorePoints);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-8 outline-none sm:py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">הניתוחים שלי</h1>
      </div>

      <Link
        href="/upload"
        className={`mt-6 w-full ${buttonVariants({ size: "lg" })}`}
      >
        + העלאת שיחה חדשה
      </Link>

      {scorePoints.length > 0 && (
        <div className="mt-8 space-y-6">
          <StatsBar stats={stats} />
          <ScoreChart points={scorePoints} />
        </div>
      )}

      {analyses.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="עדיין אין לך ניתוחים — הניתוח הראשון שלך מחכה לקובץ"
          description="העלה הקלטה של שיחת מכירה ותקבל ניתוח אישיות הלקוח, ציון ביצועים מפורט וצעדים הבאים מומלצים — הכל אוטומטית, בתוך דקות."
          action={
            <Link href="/upload" className={buttonVariants()}>
              העלאת השיחה הראשונה
            </Link>
          }
        />
      ) : (
        <ul className="mt-8 space-y-3">
          {analyses.map((a, i) => {
            const score = a.scores?.overall;
            const sc =
              typeof score === "number" ? scoreColor(score) : null;
            return (
              <li
                key={a.id}
                className="animate-fade-up flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 transition hover:border-zinc-700 hover:bg-zinc-800/40 sm:px-5 sm:py-4"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <Link
                  href={`/analysis/${a.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-zinc-200">
                      {a.file_name}
                    </span>
                    <span
                      dir="ltr"
                      className="mt-0.5 block text-right font-mono text-xs tabular-nums text-zinc-500 sm:text-left"
                    >
                      {dateFmt.format(new Date(a.created_at))}
                    </span>
                  </div>

                  {sc && typeof score === "number" && (
                    <span
                      dir="ltr"
                      className={`font-mono text-lg font-bold tabular-nums ${sc.text}`}
                      title="ציון השיחה"
                    >
                      {Math.round(score)}
                    </span>
                  )}

                  <Pill tone={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Pill>
                </Link>

                <DeleteAnalysisButton analysisId={a.id} fileName={a.file_name} compact />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
