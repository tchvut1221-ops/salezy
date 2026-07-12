import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 5;

/**
 * Wider window for the per-email cap than the per-IP one: its job is to
 * blunt distributed email-bombing / brute-force spread across many source
 * IPs targeting one address, which a short per-IP window can't see at all.
 */
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX_REQUESTS = 5;

/**
 * True when both the IP and the email are still under their caps for
 * `route` — and, only if allowed, records this request (one row, both
 * dimensions) toward both counts. DB-backed (not in-memory) since serverless
 * instances don't share memory.
 */
export async function checkRateLimit(
  route: "send" | "verify",
  identifiers: { ip: string; email: string }
): Promise<boolean> {
  const admin = createAdminClient();
  const { ip, email } = identifiers;
  const ipSince = new Date(Date.now() - WINDOW_MS).toISOString();
  const emailSince = new Date(Date.now() - EMAIL_WINDOW_MS).toISOString();

  const [ipResult, emailResult] = await Promise.all([
    admin
      .from("otp_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("route", route)
      .gte("created_at", ipSince),
    admin
      .from("otp_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("route", route)
      .gte("created_at", emailSince),
  ]);

  if ((ipResult.count ?? 0) >= MAX_REQUESTS || (emailResult.count ?? 0) >= EMAIL_MAX_REQUESTS) {
    return false;
  }

  await admin.from("otp_rate_limits").insert({ ip, email, route });
  return true;
}

/**
 * On Vercel (non-Enterprise), x-forwarded-for is already overwritten by
 * Vercel's edge with the real client IP — client-supplied values are
 * discarded, not appended, so it isn't spoofable the way a traditional
 * multi-hop proxy chain would be. x-real-ip carries the same value as a
 * single canonical header (per Vercel's docs), which is what we prefer here
 * for clarity; the last x-forwarded-for hop is the fallback for other hosts
 * (e.g. local dev, or a future non-Vercel deploy) where it — not the first,
 * client-controlled hop — is the one nearest to us.
 */
export function getClientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",");
    return hops[hops.length - 1]?.trim() ?? "unknown";
  }

  return "unknown";
}
