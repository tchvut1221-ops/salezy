import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Analysis } from "@/types";
import { AnalysisView } from "@/components/salezy/analysis-view";
import "./print.css";

/**
 * Dynamic title from the analysis's own uploaded file name (the one
 * always-present, structured identifier on the row — there's no separate
 * company/customer name field) — falls back to the generic title if the row
 * is gone by the time metadata resolves (notFound() in the page itself is
 * the real 404 handling; this only avoids a redundant throw here).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("analyses")
    .select("file_name")
    .eq("id", id)
    .single();
  return { title: data?.file_name ?? "ניתוח שיחה" };
}

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
    // AnalysisView renders the PageHeader itself: its actions (delete, PDF)
    // depend on the analysis' live status, which only the client view tracks.
    <main id="main-content" tabIndex={-1} className="w-full outline-none">
      <AnalysisView initial={data as Analysis} isFirstAnalysis={!otherCompletedCount} />
    </main>
  );
}
