"use server";

import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

/**
 * Kicks off background processing for an already-uploaded recording.
 * Verifies the caller owns the analysis row before sending the Inngest event.
 */
export async function startAnalysis(analysisId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, file_path")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  // The row (including file_path) is inserted client-side before this action
  // runs — RLS only guarantees user_id matches, not that file_path actually
  // points into the caller's own storage folder. The Inngest worker downloads
  // via the service-role client (bypasses storage RLS), so this must be
  // checked here too, not just trusted.
  if (!data.file_path.startsWith(`${user.id}/`)) {
    throw new Error("Invalid analysis file path");
  }

  await inngest.send({
    name: "analysis/requested",
    data: { analysisId },
  });
}
