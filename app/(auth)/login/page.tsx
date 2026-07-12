"use client";

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
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-2xl font-bold text-foreground">התחברות</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {step === "email"
            ? "התחברות עם קוד חד-פעמי — בלי סיסמאות."
            : `שלחנו קוד אימות ל-${email}.`}
        </p>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="mt-6 space-y-4">
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-700 bg-elevated px-4 py-2.5 font-mono text-foreground placeholder-zinc-500 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
            <Button type="submit" disabled={status === "sending"} className="w-full">
              {status === "sending" ? "שולח..." : "שלח לי קוד"}
            </Button>
            {status === "error" && (
              <p className="text-sm text-score-low">{message}</p>
            )}
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="mt-6 space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              dir="ltr"
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="קוד מהמייל"
              className="w-full rounded-lg border border-zinc-700 bg-elevated px-4 py-2.5 text-center font-mono text-lg tracking-widest text-foreground placeholder-zinc-500 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
            <Button
              type="submit"
              disabled={status === "sending" || otp.length === 0}
              className="w-full"
            >
              {status === "sending" ? "מאמת..." : "אישור"}
            </Button>
            {status === "error" && (
              <p className="text-sm text-score-low">{message}</p>
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
