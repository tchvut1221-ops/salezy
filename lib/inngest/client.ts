import { Inngest } from "inngest";

/**
 * Inngest client for Salezy background jobs.
 *
 * Reads INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY from the environment
 * automatically (no need to pass them here).
 *
 * Heavy work (audio download, ffmpeg chunking, Whisper transcription,
 * GPT-4o analysis) MUST run inside Inngest step functions — never directly
 * in a Next.js API route — so each step stays within the serverless time
 * budget and gets automatic retries.
 */
export const inngest = new Inngest({ id: "salezy" });
