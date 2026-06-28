import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 5;

/**
 * True when this IP is still under MAX_REQUESTS for `route` in the last
 * minute — and records this request toward that count. DB-backed (not
 * in-memory) since serverless instances don't share memory.
 */
export async function checkRateLimit(
  ip: string,
  route: "send" | "verify"
): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count } = await admin
    .from("otp_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("route", route)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_REQUESTS) {
    return false;
  }

  await admin.from("otp_rate_limits").insert({ ip, route });
  return true;
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? "unknown";
}
