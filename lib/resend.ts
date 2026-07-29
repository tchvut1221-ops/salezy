const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

/** Sends the OTP code via Resend's HTTP API. Server-only. */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  console.log("[resend] Sending OTP to:", email, "from:", RESEND_FROM_EMAIL);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Salezy <${RESEND_FROM_EMAIL}>`,
      to: email,
      subject: "קוד הכניסה שלך ל-Salezy",
      html: otpEmailHtml(code),
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("[resend] API error:", res.status, errorBody);
    throw new Error(`Resend API error ${res.status}: ${errorBody}`);
  }

  console.log("[resend] Email sent successfully to:", email);
}

function otpEmailHtml(code: string): string {
  return `
    <div dir="rtl" style="font-family: system-ui, -apple-system, sans-serif; background:#0A0A0F; color:#F0F0FF; padding:32px; border-radius:16px; max-width:420px; margin:0 auto;">
      <p style="font-size:14px; color:#8888AA; margin:0 0 16px;">קוד הכניסה שלך ל-Salezy</p>
      <p style="font-family: Consolas, 'Liberation Mono', Menlo, monospace; font-size:32px; letter-spacing:6px; font-weight:700; color:#4D7EFF; margin:0 0 16px; direction:ltr; text-align:center;">${code}</p>
      <p style="font-size:13px; color:#8888AA; margin:0;">הקוד בתוקף ל-10 דקות. אם לא ביקשת קוד זה, אפשר להתעלם מהמייל.</p>
    </div>
  `;
}
