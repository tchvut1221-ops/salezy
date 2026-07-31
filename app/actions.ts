"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { parseId, parsePracticeMessage } from "@/lib/validation";
import {
  buildPersonaSystemPrompt,
  sendPracticeTurn,
  generateFeedback,
  computeStreakDays,
} from "@/lib/practice";
import type { AnalysisStatus, PersonalityType } from "@/types";
import type {
  PracticeSectionKey,
  PracticeSession,
  PracticeMessage,
  PracticeSessionOutcome,
  PracticeFeedback,
} from "@/types";

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
 * Re-runs the pipeline for an analysis that previously `failed` or
 * `no_speech_detected`. The original upload still lives in Storage
 * (file_path), so we just reset the row to a clean "uploaded" state, clear
 * the error, and re-emit the Inngest event. Ownership is verified
 * server-side; RLS on the UPDATE is the real guard, the user_id check is
 * defense-in-depth.
 */
export async function retryAnalysis(analysisId: string) {
  const id = parseId(analysisId, "Analysis not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, transcript, completed_steps, audio_deleted_at")
    .eq("id", id)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }
  if (data.status !== "failed" && data.status !== "no_speech_detected") {
    throw new Error("Analysis is not in a retryable state");
  }
  // Once the retention sweep deleted the raw recording, a re-run can only
  // succeed if transcription already finished — the pipeline's skip logic
  // (lib/inngest/functions.ts) then reads the persisted transcript instead
  // of re-downloading the audio. Mirrors that skip condition exactly.
  const completedSteps: string[] = data.completed_steps ?? [];
  if (
    data.audio_deleted_at &&
    !(completedSteps.includes("transcribe") && data.transcript)
  ) {
    throw new Error(
      "ההקלטה נמחקה בהתאם למדיניות השמירה, ולכן לא ניתן להריץ את הניתוח מחדש."
    );
  }

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: "uploaded", error: null })
    .eq("id", id);
  if (updateError) throw updateError;

  await inngest.send({ name: "analysis/requested", data: { analysisId: id } });
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
  const id = parseId(analysisId, "Analysis not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }
  if (!RUNNING_STATUSES.includes(data.status as AnalysisStatus)) {
    throw new Error("Analysis is not currently running");
  }

  await inngest.send({ name: "analysis/cancel-requested", data: { analysisId: id } });

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: "cancelled", error: null })
    .eq("id", id)
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
  const id = parseId(analysisId, "Analysis not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, completed_steps, transcript, audio_deleted_at")
    .eq("id", id)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }
  if (data.status !== "cancelled") {
    throw new Error("Analysis is not cancelled");
  }
  // Same recording-gone guard as retryAnalysis above: resuming a run whose
  // transcription never finished needs the raw audio, which the retention
  // sweep may have already deleted.
  const completedSteps: string[] = data.completed_steps ?? [];
  if (
    data.audio_deleted_at &&
    !(completedSteps.includes("transcribe") && data.transcript)
  ) {
    throw new Error(
      "ההקלטה נמחקה בהתאם למדיניות השמירה, ולכן לא ניתן להמשיך את הניתוח."
    );
  }

  // Reflects which stage is about to run so the UI doesn't show a misleading
  // "transcribing" progress step when transcription already finished.
  const nextStatus = completedSteps.includes("transcribe")
    ? "analyzing"
    : "transcribing";

  const { error: updateError } = await supabase
    .from("analyses")
    .update({ status: nextStatus, error: null })
    .eq("id", id);
  if (updateError) throw updateError;

  await inngest.send({
    name: "analysis/requested",
    data: { analysisId: id, isResume: true },
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
  const id = parseId(analysisId, "Analysis not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("analyses")
    .select("id, user_id, status, file_path, audio_deleted_at")
    .eq("id", id)
    .single();

  if (error || !data || data.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  if (RUNNING_STATUSES.includes(data.status as AnalysisStatus)) {
    await inngest.send({ name: "analysis/cancel-requested", data: { analysisId: id } });
  }

  // Skip the storage call when the retention sweep already removed the file.
  if (!data.audio_deleted_at) {
    const { error: storageError } = await supabase.storage
      .from("recordings")
      .remove([data.file_path]);
    if (storageError) {
      console.error(
        `[deleteAnalysis] Failed to remove storage file for ${id} (${data.file_path}):`,
        storageError
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("analyses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (deleteError) throw deleteError;

  revalidatePath("/dashboard");
}

/**
 * Starts a new practice session: verifies the user owns `analysisId` (the
 * only thing worth re-checking server-side — sectionKey/focusText/
 * personalityType are trusted display values the client already computed
 * from that same analysis, no security boundary crosses if they're
 * user-supplied, so no point re-deriving them here), gets the AI's opening
 * line, and persists the session.
 */
export async function startPracticeSession(
  analysisId: string,
  sectionKey: PracticeSectionKey,
  focusText: string,
  personalityType: PersonalityType
): Promise<PracticeSession> {
  const id = parseId(analysisId, "Analysis not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (analysisError || !analysis || analysis.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  const systemPrompt = buildPersonaSystemPrompt(sectionKey, focusText, personalityType);
  const opening = await sendPracticeTurn(systemPrompt, []);

  const { data, error } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: user.id,
      analysis_id: id,
      section_key: sectionKey,
      focus_text: focusText,
      personality_type: personalityType,
      messages: [{ role: "customer", content: opening }] satisfies PracticeMessage[],
      status: "in_progress",
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to start practice session");

  return data as PracticeSession;
}

/** Sends one user turn, appends the AI's reply, persists the full updated session. */
export async function sendPracticeMessage(
  sessionId: string,
  text: string
): Promise<PracticeSession> {
  const id = parseId(sessionId, "Practice session not found");
  const message = parsePracticeMessage(text);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !session || session.user_id !== user.id) {
    throw new Error("Practice session not found");
  }
  if (session.status !== "in_progress") {
    throw new Error("Practice session already ended");
  }

  const systemPrompt = buildPersonaSystemPrompt(
    session.section_key,
    session.focus_text,
    session.personality_type
  );
  const updatedMessages: PracticeMessage[] = [
    ...(session.messages as PracticeMessage[]),
    { role: "user", content: message },
  ];
  const reply = await sendPracticeTurn(systemPrompt, updatedMessages);
  updatedMessages.push({ role: "customer", content: reply });

  const { data: updated, error: updateError } = await supabase
    .from("practice_sessions")
    .update({ messages: updatedMessages })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (updateError || !updated) throw updateError ?? new Error("Failed to send message");

  return updated as PracticeSession;
}

/**
 * Ends a session: generates short scored feedback, marks the session
 * completed, then computes the two D5 "gentle gamification" numbers —
 * streakDays (consecutive-day habit across ALL of this user's practice, not
 * just this section) and attemptCount (completed sessions for this exact
 * analysis+section, including the one just finished). Both are cheap
 * server-side reads over an already-indexed column (user_id), not a new
 * aggregation table.
 */
export async function endPracticeSession(sessionId: string): Promise<PracticeSessionOutcome> {
  const id = parseId(sessionId, "Practice session not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !session || session.user_id !== user.id) {
    throw new Error("Practice session not found");
  }
  if (session.status !== "in_progress") {
    throw new Error("Practice session already ended");
  }

  const feedback = await generateFeedback(session.messages as PracticeMessage[], session.focus_text);

  const { error: updateError } = await supabase
    .from("practice_sessions")
    .update({ feedback, status: "completed" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) throw updateError;

  // 90 days of completed-session dates is comfortably more than any real
  // streak; a Nth-attempt count is a plain row count. Independent reads, run
  // together.
  const [{ data: recentCompletions }, { count: attemptCount }] = await Promise.all([
    supabase
      .from("practice_sessions")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("practice_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("analysis_id", session.analysis_id)
      .eq("section_key", session.section_key)
      .eq("status", "completed"),
  ]);

  return {
    feedback,
    streakDays: computeStreakDays((recentCompletions ?? []).map((r) => r.created_at)),
    attemptCount: attemptCount ?? 1,
  };
}

/**
 * Which coachingActions indices (components/salezy/coaching-plan.tsx) this
 * user has marked done for this analysis. Returns an empty set — never
 * throws — on ANY read failure, not just a missing table: this is a
 * decorative checklist, not something the coaching plan's own rendering
 * should ever depend on or break over. Concretely covers the case where
 * migration 0016 hasn't been applied yet (PGRST205, same class of gap as
 * 0009's and 0015's — see project history), so a deploy that ships this
 * code before the migration is run degrades to "nothing marked done" rather
 * than a broken page.
 */
export async function getCoachingCompletions(analysisId: string): Promise<ReadonlySet<number>> {
  const id = parseId(analysisId, "Analysis not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("coaching_completions")
    .select("action_index")
    .eq("analysis_id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error(
      "[getCoachingCompletions] read failed (migration 0016 may not be applied yet):",
      error.message
    );
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.action_index));
}

/**
 * Toggles one coaching action's completion: row existence IS the completed
 * state, so this is an insert (mark done) or a delete (undo), never an
 * update. Best-effort and silent on failure for the same reason as
 * getCoachingCompletions above — never surface an error to the user over a
 * checklist checkbox.
 */
export async function toggleCoachingCompletion(
  analysisId: string,
  actionIndex: number,
  actionText: string,
  completed: boolean
): Promise<void> {
  const id = parseId(analysisId, "Analysis not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Ownership check, same defense-in-depth convention as every other action
  // in this file: RLS on coaching_completions only checks the completion
  // row's OWN user_id, not that analysis_id belongs to that same user.
  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (analysisError || !analysis || analysis.user_id !== user.id) {
    console.error(`[toggleCoachingCompletion] analysis ${id} not found or not owned by caller`);
    return;
  }

  if (completed) {
    const { error } = await supabase.from("coaching_completions").insert({
      user_id: user.id,
      analysis_id: id,
      action_index: actionIndex,
      action_text: actionText,
    });
    if (error) {
      console.error(
        "[toggleCoachingCompletion] insert failed (migration 0016 may not be applied yet):",
        error.message
      );
    }
  } else {
    const { error } = await supabase
      .from("coaching_completions")
      .delete()
      .eq("analysis_id", id)
      .eq("action_index", actionIndex)
      .eq("user_id", user.id);
    if (error) {
      console.error("[toggleCoachingCompletion] delete failed:", error.message);
    }
  }
}

/**
 * Past COMPLETED practice sessions for this exact analysis+section, most
 * recent first — same (analysisId, sectionKey) scope endPracticeSession's
 * attemptCount already uses. `excludeSessionId` leaves out the session that
 * just finished (its own feedback is already shown front-and-center on the
 * same screen; repeating it inside "previous practices" would be redundant).
 */
export async function getPracticeHistory(
  analysisId: string,
  sectionKey: PracticeSectionKey,
  excludeSessionId?: string
): Promise<Array<{ id: string; createdAt: string; feedback: PracticeFeedback | null }>> {
  const id = parseId(analysisId, "Analysis not found");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("practice_sessions")
    .select("id, created_at, feedback")
    .eq("user_id", user.id)
    .eq("analysis_id", id)
    .eq("section_key", sectionKey)
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  if (excludeSessionId) {
    query = query.neq("id", parseId(excludeSessionId, "Practice session not found"));
  }

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    feedback: row.feedback as PracticeFeedback | null,
  }));
}
