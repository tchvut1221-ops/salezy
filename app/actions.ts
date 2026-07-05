"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import type { AnalysisStatus } from "@/types";

/** Non-terminal statuses — the pipeline is still actively running. */
const RUNNING_STATUSES: AnalysisStatus[] = [
  "uploaded",
  "converting",
  "transcribing",
  "analyzing",
];

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

/**
 * Stops a running analysis. Sends the cancellation event that `analyzeCall`'s
 * `cancelOn` config (lib/inngest/functions.ts) matches on to halt the pipeline
 * before its next step, then flips the row to "cancelled" directly — a
 * cancelled Inngest run does NOT go through onFailure (that's a distinct
 * lifecycle for genuine failures), so nothing else will set this status.
 * Ownership verified server-side; RLS on the UPDATE is the real guard, the
 * user_id check is defense-in-depth.
 */
export async function cancelAnalysis(analysisId: string) {
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
  if (!RUNNING_STATUSES.includes(data.status as AnalysisStatus)) {
    throw new Error("Analysis is not currently running");
  }

  await inngest.send({ name: "analysis/cancel-requested", data: { analysisId } });

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: "cancelled", error: null })
    .eq("id", analysisId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;
}

/**
 * Resumes a cancelled analysis from where it stopped, instead of restarting
 * from scratch. Doesn't reset `completed_steps`/`transcript`/`reasoning` —
 * analyzeCall (lib/inngest/functions.ts) reads those from the row itself and
 * skips whichever stages already finished before the stop. `isResume: true`
 * on the event is informational only (visible in Inngest's dashboard/logs);
 * the actual skip logic is driven by what's persisted, not this flag.
 */
export async function resumeAnalysis(analysisId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, completed_steps")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }
  if (data.status !== "cancelled") {
    throw new Error("Analysis is not cancelled");
  }

  // Reflects which stage is about to run so the UI doesn't show a misleading
  // "transcribing" progress step when transcription already finished.
  const completedSteps: string[] = data.completed_steps ?? [];
  const nextStatus = completedSteps.includes("transcribe")
    ? "analyzing"
    : "transcribing";

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: nextStatus, error: null })
    .eq("id", analysisId);
  if (updateError) throw updateError;

  await inngest.send({
    name: "analysis/requested",
    data: { analysisId, isResume: true },
  });
}

/**
 * Permanently deletes an analysis: cancels it first if still running (best
 * effort — Inngest cancellation isn't synchronous, but dispatching it before
 * deleting the row it would otherwise try to update is the correct order),
 * removes the recording from Storage, then deletes the row. A storage
 * removal failure is logged but doesn't block the row delete — an orphaned
 * file is a lesser problem than a row a user can't get rid of. Ownership
 * verified server-side; RLS on both the storage object and the row is the
 * real guard (see supabase/migrations/0001, 0002), the user_id check is
 * defense-in-depth.
 */
export async function deleteAnalysis(analysisId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, file_path")
    .eq("id", analysisId)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  if (RUNNING_STATUSES.includes(data.status as AnalysisStatus)) {
    await inngest.send({ name: "analysis/cancel-requested", data: { analysisId } });
  }

  const { error: storageError } = await supabase.storage
    .from("recordings")
    .remove([data.file_path]);
  if (storageError) {
    console.error(
      `[deleteAnalysis] Failed to remove storage file for ${analysisId} (${data.file_path}):`,
      storageError
    );
  }

  const { error: deleteError } = await supabase
    .from("analyses")
    .delete()
    .eq("id", analysisId)
    .eq("user_id", user.id);
  if (deleteError) throw deleteError;

  revalidatePath("/dashboard");
}
