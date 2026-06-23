import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { computeStats, fetchScorePoints } from "@/lib/analytics";
import { StatsBar } from "@/components/salezy/stats-bar";
import { ScoreChart } from "@/components/salezy/score-chart";
import type { AnalysisStatus } from "@/types";

type AnalysisListItem = { id: string; file_name: string; status: AnalysisStatus };

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  uploaded: "בתור",
  converting: "ממיר קובץ",
  transcribing: "מתמלל",
  analyzing: "מנתח",
  completed: "מוכן",
  failed: "נכשל",
};

const STATUS_COLORS: Record<AnalysisStatus, string> = {
  uploaded: "text-zinc-400",
  converting: "text-score-mid",
  transcribing: "text-score-mid",
  analyzing: "text-score-mid",
  completed: "text-score-high",
  failed: "text-score-low",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // List only needs these 3 fields — avoid pulling the full `result` jsonb
  // (the entire AI analysis output) for every row just to render a status
  // badge. Runs alongside the analytics query instead of after it; neither
  // depends on the other's result.
  const [{ data }, scorePoints] = await Promise.all([
    supabase
      .from("analyses")
      .select("id, file_name, status")
      .order("created_at", { ascending: false }),
    fetchScorePoints(supabase, user.id),
  ]);

  const analyses = (data ?? []) as AnalysisListItem[];

  // Stats bar + trend chart reuse the same query/aggregation helper that
  // backs app/api/analytics/route.ts (kept DRY). This is a server component,
  // so it queries Supabase directly instead of round-tripping through our
  // own HTTP route. Hidden entirely when the user has zero v2/scored calls
  // (v1 analyses have no `scores`) so we never render an empty/broken chart.
  const stats = computeStats(scorePoints);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">הניתוחים שלי</h1>
        <form action={signOut}>
          <button className="text-sm text-zinc-400 transition-colors hover:text-foreground">
            התנתק
          </button>
        </form>
      </div>

      <Link
        href="/upload"
        className="mt-6 block rounded-lg bg-primary px-4 py-3 text-center font-medium text-primary-foreground transition hover:bg-primary/90"
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
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
            <p className="font-medium text-zinc-200">
              עדיין אין לך ניתוחים — הניתוח הראשון שלך מחכה לקובץ
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
              העלה הקלטה של שיחת מכירה ותקבל ניתוח אישיות הלקוח, ציון ביצועים
              מפורט וצעדים הבאים מומלצים — הכל אוטומטית, בתוך דקות.
            </p>
          </div>
        ) : (
          analyses.map((a) => (
            <Link
              key={a.id}
              href={`/analysis/${a.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-zinc-700"
            >
              <span className="truncate text-zinc-200">{a.file_name}</span>
              <span className={`text-sm ${STATUS_COLORS[a.status]}`}>
                {STATUS_LABELS[a.status]}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
