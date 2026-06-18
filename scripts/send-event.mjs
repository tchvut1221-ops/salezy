/**
 * Manually send an `analysis/requested` event to Inngest Cloud — used to
 * re-trigger a stuck analysis or to test the event → function path.
 *
 * Usage:
 *   node --env-file=.env.local scripts/send-event.mjs <analysisId>
 *
 * Uses INNGEST_EVENT_KEY from the environment. Prints the returned event id(s)
 * on success, or the SDK error on failure (e.g. an invalid event key).
 */
import { Inngest } from "inngest";

const analysisId = process.argv[2];
if (!analysisId) {
  console.error("usage: send-event.mjs <analysisId>");
  process.exit(1);
}

const inngest = new Inngest({ id: "salezy" });

try {
  const res = await inngest.send({
    name: "analysis/requested",
    data: { analysisId },
  });
  console.log("✅ sent:", JSON.stringify(res));
} catch (err) {
  console.error("❌ send failed:", err?.message ?? err);
  process.exit(1);
}
