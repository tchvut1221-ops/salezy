"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, fileExtension } from "@/lib/constants";
import { parseId } from "@/lib/validation";

/**
 * Kicks off background processing for an already-uploaded recording.
 * Verifies the caller owns the analysis row before sending the Inngest event.
 */
export async function startAnalysis(analysisId: string) {
  const id = parseId(analysisId, "Analysis not found");
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
    .eq("id", id)
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

  await assertUploadedObjectIsValid(data.file_path, id);

  await inngest.send({
    name: "analysis/requested",
    data: { analysisId: id },
  });
}

/**
 * `isAllowedAudio` (lib/constants.ts) only runs in the browser — a client
 * that skips it entirely (or lies about File.size/name) can still complete
 * the TUS upload and reach this action, since Storage's own bucket-level
 * MIME/size limits (migration 0014) enforce on `Content-Type` and length,
 * neither of which the browser is required to send honestly either. This is
 * the server-side check: it reads back the object's actual stored metadata
 * from Storage (not the client's claims about it) via the admin client,
 * before any paid transcription work is scheduled. No magic-byte sniff —
 * disproportionate here, since the pipeline's ffmpeg-based checkHasSpeech
 * guard (lib/audio.ts) already rejects non-audio content for free right
 * after this.
 */
async function assertUploadedObjectIsValid(filePath: string, analysisId: string) {
  const ext = fileExtension(filePath);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    await failUpload(analysisId, filePath, "סוג הקובץ אינו נתמך.");
    throw new Error("Unsupported file extension");
  }

  const admin = createAdminClient();
  const folder = filePath.slice(0, filePath.lastIndexOf("/"));
  const objectName = filePath.slice(filePath.lastIndexOf("/") + 1);
  const { data: listing, error } = await admin.storage
    .from("recordings")
    .list(folder, { search: objectName, limit: 1 });

  if (error || !listing?.length) {
    await failUpload(analysisId, filePath, "הקובץ לא נמצא לאחר ההעלאה.");
    throw new Error("Uploaded object not found in storage");
  }

  const size = listing[0].metadata?.size;
  if (typeof size === "number" && size > MAX_FILE_BYTES) {
    await failUpload(analysisId, filePath, "הקובץ חורג מהגודל המותר.");
    throw new Error("Uploaded object exceeds MAX_FILE_BYTES");
  }
}

/** Marks the row failed (sanitized Hebrew message) and removes the bad object, best-effort. */
async function failUpload(analysisId: string, filePath: string, message: string) {
  const admin = createAdminClient();
  await admin.from("analyses").update({ status: "failed", error: message }).eq("id", analysisId);
  await admin.storage.from("recordings").remove([filePath]);
}
