import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { computeStats, fetchScorePoints } from "@/lib/analytics";
import { StatsBar } from "@/components/salezy/stats-bar";
import { ScoreChart } from "@/components/salezy/score-chart";
import type { Analysis, AnalysisStatus } from "@/types";

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
  converting: "text-amber-400",
  transcribing: "text-amber-400",
  analyzing: "text-amber-400",
  completed: "text-emerald-400",
  failed: "text-red-400",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false });

  const analyses = (data ?? []) as Analysis[];

  // Stats bar + trend chart reuse the same query/aggregation helper that
  // backs app/api/analytics/route.ts (kept DRY). This is a server component,
  // so it queries Supabase directly instead of round-tripping through our
  // own HTTP route. Hidden entirely when the user has zero v2/scored calls
  // (v1 analyses have no `scores`) so we never render an empty/broken chart.
  const scorePoints = await fetchScorePoints(supabase, user.id);
  const stats = computeStats(scorePoints);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">הניתוחים שלי</h1>
        <form action={signOut}>
          <button className="text-sm text-zinc-400 hover:text-white">
            התנתק
          </button>
        </form>
      </div>

      <Link
        href="/upload"
        className="mt-6 block rounded-lg bg-emerald-600 px-4 py-3 text-center font-medium text-white transition hover:bg-emerald-500"
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
          <p className="text-center text-sm text-zinc-500">
            עדיין אין ניתוחים. העלה את השיחה הראשונה שלך.
          </p>
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
