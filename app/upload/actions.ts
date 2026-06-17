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
    .select("id, user_id")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  await inngest.send({
    name: "analysis/requested",
    data: { analysisId },
  });
}
