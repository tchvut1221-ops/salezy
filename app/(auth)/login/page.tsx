"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/salezy/ui";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    // The checkbox below is `required`, so the browser already blocks
    // getting here at all with it unchecked — reaching handleSendCode is
    // itself proof of consent for the record app/api/auth/verify-otp
    // writes on successful login.
    setStatus("sending");
    setMessage("");

    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "שליחת הקוד נכשלה. בדוק את כתובת המייל ונסה שוב.");
    } else {
      setStatus("idle");
      setStep("otp");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: otp }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "הקוד שגוי או שפג תוקפו. נסה שוב.");
    } else {
      router.push("/dashboard");
    }
  }

  function handleChangeEmail() {
    setStep("email");
    setOtp("");
    setStatus("idle");
    setMessage("");
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 items-center justify-center px-4 py-16 outline-none"
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-2xl font-bold text-foreground">התחברות</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {step === "email"
            ? "התחברות עם קוד חד-פעמי — בלי סיסמאות."
            : `שלחנו קוד אימות ל-${email}.`}
        </p>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="mt-6 space-y-4">
            <label htmlFor="email" className="sr-only">
              כתובת מייל
            </label>
            <input
              id="email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-700 bg-elevated px-4 py-2.5 font-mono text-foreground placeholder-zinc-500 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
            />
            <label htmlFor="consent" className="flex items-start gap-2 text-xs leading-relaxed text-zinc-400">
              <input
                id="consent"
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-elevated text-primary focus:ring-2 focus:ring-ring"
              />
              <span>
                קראתי ואני מסכים/ה ל
                <Link href="/terms" target="_blank" className="text-primary underline underline-offset-2">
                  תנאי השימוש
                </Link>{" "}
                ול
                <Link href="/privacy" target="_blank" className="text-primary underline underline-offset-2">
                  מדיניות הפרטיות
                </Link>
                , לרבות אחריותי לכך שהקלטות שאני מעלה נעשו כדין.
              </span>
            </label>
            <Button type="submit" disabled={status === "sending"} aria-disabled={status === "sending"} className="w-full">
              {status === "sending" ? "שולח..." : "שלח לי קוד"}
            </Button>
            <p className="sr-only" role="status" aria-live="polite">
              {status === "sending" ? "שולח קוד אימות..." : ""}
            </p>
            {status === "error" && (
              <p role="alert" className="text-sm text-score-low">{message}</p>
            )}
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="mt-6 space-y-4">
            <label htmlFor="otp" className="sr-only">
              קוד אימות
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              dir="ltr"
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="קוד מהמייל"
              className="w-full rounded-lg border border-zinc-700 bg-elevated px-4 py-2.5 text-center font-mono text-lg tracking-widest text-foreground placeholder-zinc-500 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
            />
            <Button
              type="submit"
              disabled={status === "sending" || otp.length === 0}
              aria-disabled={status === "sending" || otp.length === 0}
              className="w-full"
            >
              {status === "sending" ? "מאמת..." : "אישור"}
            </Button>
            <p className="sr-only" role="status" aria-live="polite">
              {status === "sending" ? "מאמת קוד..." : ""}
            </p>
            {status === "error" && (
              <p role="alert" className="text-sm text-score-low">{message}</p>
            )}
            <Button variant="ghost" onClick={handleChangeEmail} className="w-full">
              שינוי כתובת מייל
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
