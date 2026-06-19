import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeStats, fetchScorePoints } from "@/lib/analytics";

/**
 * Returns this user's v2 call-score points plus the derived stats
 * (see lib/analytics.ts for the aggregation + improvement-delta definition).
 *
 * Auth: uses the RLS-respecting server client (cookie session), never the
 * admin client — Postgres RLS (`auth.uid() = user_id` on public.analyses) is
 * what actually prevents one user from ever receiving another user's rows;
 * the `.eq("user_id", ...)` inside fetchScorePoints is defense-in-depth on
 * top of that, not a substitute for it.
 *
 * Not currently called by the dashboard page itself (the page queries
 * directly via the same shared helper to avoid an extra HTTP round-trip on
 * a server component), but kept as a standalone fetchable endpoint per the
 * Stage C spec, e.g. for future client-side refresh/polling.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const points = await fetchScorePoints(supabase, user.id);
  const stats = computeStats(points);

  return NextResponse.json({ points, stats });
}
