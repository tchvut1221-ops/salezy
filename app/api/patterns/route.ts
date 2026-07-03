import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPatternsData } from "@/lib/patterns";

/**
 * Returns this user's pattern-recognition payload (see lib/patterns.ts).
 * Not called by the /patterns page itself (which queries getPatternsData
 * directly server-side to avoid an extra round trip) — kept as a standalone
 * fetchable endpoint, mirroring app/api/analytics/route.ts.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getPatternsData(supabase, user.id);
  return NextResponse.json(data);
}
