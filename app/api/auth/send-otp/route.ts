import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOtpCode, hashOtpCode, OTP_EXPIRY_MS } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/resend";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generates our own OTP (not Supabase's), stores its hash, and emails it via
 * Resend — bypassing Supabase's SMTP entirely. See app/api/auth/verify-otp
 * for how the code is redeemed for a real Supabase session.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "כתובת מייל לא תקינה." }, { status: 400 });
  }

  const ip = getClientIp(req);
  if (!(await checkRateLimit("send", { ip, email }))) {
    return NextResponse.json(
      { error: "יותר מדי בקשות. נסה שוב בעוד דקה." },
      { status: 429 }
    );
  }

  const admin = createAdminClient();
  const code = generateOtpCode();

  // Only one live code per email at a time.
  await admin.from("otp_codes").delete().eq("email", email).is("consumed_at", null);

  const { error: insertError } = await admin.from("otp_codes").insert({
    email,
    code_hash: hashOtpCode(code),
    expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
  });
  if (insertError) {
    return NextResponse.json({ error: "שליחת הקוד נכשלה. נסה שוב." }, { status: 500 });
  }

  try {
    await sendOtpEmail(email, code);
  } catch {
    return NextResponse.json({ error: "שליחת הקוד נכשלה. נסה שוב." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
