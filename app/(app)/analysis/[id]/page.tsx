import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Analysis } from "@/types";
import { AnalysisView } from "@/components/salezy/analysis-view";
import "./print.css";

export const metadata: Metadata = { title: "ניתוח שיחה" };

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data, error }, { count: otherCompletedCount }] = await Promise.all([
    supabase.from("analyses").select("*").eq("id", id).single(),
    // D6 first-analysis celebration: "first" means no OTHER completed
    // analysis exists for this user yet. A cheap indexed count, not a full
    // row fetch — and it self-resolves once a second call completes, so no
    // dismissal state needs to be persisted anywhere.
    supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .neq("id", id),
  ]);

  if (error || !data) notFound();

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-12 outline-none">
      <AnalysisView initial={data as Analysis} isFirstAnalysis={!otherCompletedCount} />
    </main>
  );
}
