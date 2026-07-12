import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { codeMatches, OTP_MAX_VERIFY_ATTEMPTS } from "@/lib/otp";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * Verifies our own OTP against its stored hash, then exchanges it for a real
 * Supabase session: admin.generateLink (creates the user if needed) returns
 * an email_otp — the raw OTP token meant for verifyOtp, as opposed to
 * hashed_token which is only valid via the action_link redirect flow — which
 * we redeem server-side so the SSR client below writes real session cookies
 * onto this response, the same outcome as Supabase's own OTP flow, just with
 * our code/email as the front door.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  const invalid = () =>
    NextResponse.json({ error: "קוד שגוי או שפג תוקפו." }, { status: 400 });

  if (!email || !code) return invalid();

  const ip = getClientIp(req);
  if (!(await checkRateLimit("verify", { ip, email }))) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות. נסה שוב בעוד דקה." },
      { status: 429 }
    );
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("otp_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("email", email)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row || new Date(row.expires_at) < new Date()) return invalid();
  if (row.attempts >= OTP_MAX_VERIFY_ATTEMPTS) return invalid();

  if (!codeMatches(code, row.code_hash)) {
    await admin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return invalid();
  }

  // Code is correct — exchange it for a real session before marking it
  // consumed, so a transient failure below doesn't burn a valid code the
  // user can't retry.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link) {
    // Message only — the full error object can carry request context (email).
    console.error("[verify-otp] generateLink failed:", linkError?.message);
    return NextResponse.json({ error: "ההתחברות נכשלה. נסה שוב." }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: "magiclink",
  });
  if (verifyError) {
    console.error("[verify-otp] verifyOtp failed:", verifyError.message);
    return NextResponse.json({ error: "ההתחברות נכשלה. נסה שוב." }, { status: 500 });
  }

  await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return NextResponse.json({ success: true });
}
