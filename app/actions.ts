"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Re-runs the pipeline for an analysis that previously `failed`. The original
 * upload still lives in Storage (file_path), so we just reset the row to a clean
 * "uploaded" state, clear the error, and re-emit the Inngest event. Ownership is
 * verified server-side; RLS on the UPDATE is the real guard, the user_id check
 * is defense-in-depth.
 */
export async function retryAnalysis(analysisId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: "uploaded", error: null })
    .eq("id", analysisId);
  if (updateError) throw updateError;

  await inngest.send({ name: "analysis/requested", data: { analysisId } });
}
