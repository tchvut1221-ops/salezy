import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Analysis } from "@/types";
import { AnalysisView } from "@/components/salezy/analysis-view";
import "./print.css";

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

  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <AnalysisView initial={data as Analysis} />
    </main>
  );
}
