/**
 * Throwaway live-test script (Task 6 of the pre-transcription-guard plan).
 * Uploads silent-test.wav to Supabase Storage, creates an `analyses` row via
 * the service-role client (bypassing the browser/auth UI), and sends the
 * analysis/requested Inngest event — mirroring app/upload/page.tsx's real
 * flow and app/upload/actions.ts's startAnalysis, but scripted.
 *
 * Uses the account explicitly confirmed by the user (tchvut1221@gmail.com),
 * looked up by exact email via the Supabase auth admin API — not inferred
 * from table contents.
 *
 * Usage: node --env-file=.env.local _tmp-live-test-trigger.mjs
 */
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Inngest } from "inngest";

const TEST_USER_EMAIL = "tchvut1221@gmail.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Look up the confirmed account by exact email via the auth admin API — no
// inference from table contents.
let userId;
{
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("listUsers failed:", error.message);
      process.exit(1);
    }
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === TEST_USER_EMAIL.toLowerCase()
    );
    if (match) {
      userId = match.id;
      break;
    }
    if (data.users.length < perPage) break; // last page
    page++;
  }
}
if (!userId) {
  console.error(`No user found with email ${TEST_USER_EMAIL}`);
  process.exit(1);
}
console.log(`Confirmed user_id for ${TEST_USER_EMAIL}:`, userId);

const analysisId = randomUUID();
const fileName = "silent-test.wav";
const filePath = `${userId}/${analysisId}/${fileName}`;

const buffer = await readFile("silent-test.wav");
const { error: uploadErr } = await admin.storage.from("recordings").upload(filePath, buffer, {
  contentType: "audio/wav",
  upsert: true,
});
if (uploadErr) {
  console.error("Storage upload failed:", uploadErr.message);
  process.exit(1);
}
console.log("Uploaded to Storage at:", filePath);

const { error: insertErr } = await admin.from("analyses").insert({
  id: analysisId,
  user_id: userId,
  file_name: fileName,
  file_path: filePath,
  status: "uploaded",
});
if (insertErr) {
  console.error("Insert failed:", insertErr.message);
  process.exit(1);
}
console.log("Inserted analyses row:", analysisId);

const inngest = new Inngest({ id: "salezy" });
const res = await inngest.send({ name: "analysis/requested", data: { analysisId } });
console.log("Sent analysis/requested event:", JSON.stringify(res));
console.log("\nanalysisId =", analysisId);
