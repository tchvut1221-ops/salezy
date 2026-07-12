import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStats, fetchScorePoints } from "@/lib/analytics";
import { StatsBar } from "@/components/salezy/stats-bar";
import { ScoreChart } from "@/components/salezy/score-chart";
import { Pill, buttonVariants, scoreColor } from "@/components/salezy/ui";
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
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
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

      <div className="mt-8 space-y-3">
        {analyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
            <p className="font-medium text-zinc-200">
              עדיין אין לך ניתוחים — הניתוח הראשון שלך מחכה לקובץ
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
              העלה הקלטה של שיחת מכירה ותקבל ניתוח אישיות הלקוח, ציון ביצועים
              מפורט וצעדים הבאים מומלצים — הכל אוטומטית, בתוך דקות.
            </p>
            <Link href="/upload" className={`mt-6 ${buttonVariants()}`}>
              העלאת השיחה הראשונה
            </Link>
          </div>
        ) : (
          analyses.map((a) => {
            const score = a.scores?.overall;
            const sc =
              typeof score === "number" ? scoreColor(score) : null;
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 transition hover:border-zinc-700 sm:px-5 sm:py-4"
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

                <DeleteAnalysisButton analysisId={a.id} compact />
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
