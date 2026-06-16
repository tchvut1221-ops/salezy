import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/**
 * Browser/anon client. Subject to Row Level Security.
 * Safe to use in client components and server components for user-scoped reads.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Service-role client. Bypasses RLS — SERVER ONLY.
 * Used by the Inngest background worker to update analysis rows.
 * Never import this into a client component.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_KEY (server-only)");
  }
  return createClient(supabaseUrl!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
