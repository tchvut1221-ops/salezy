import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeCall } from "@/lib/inngest/functions";
import { retentionSweep } from "@/lib/inngest/retention";

// Transcription of long calls can run for minutes; give the serverless function
// the maximum budget so an Inngest step doesn't hit FUNCTION_INVOCATION_TIMEOUT.
export const maxDuration = 300;

// serve() only verifies the Inngest request signature when INNGEST_SIGNING_KEY
// is actually set — it doesn't refuse to boot without one. A missing key in
// production would silently leave this endpoint (able to trigger the full
// paid transcription+analysis pipeline) unauthenticated. Fail fast instead of
// letting that ship unnoticed.
if (process.env.NODE_ENV === "production" && !process.env.INNGEST_SIGNING_KEY) {
  throw new Error("INNGEST_SIGNING_KEY is required in production");
}

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeCall, retentionSweep],
});
