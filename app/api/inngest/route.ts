import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeCall } from "@/lib/inngest/functions";

// Transcription of long calls can run for minutes; give the serverless function
// the maximum budget so an Inngest step doesn't hit FUNCTION_INVOCATION_TIMEOUT.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeCall],
});
