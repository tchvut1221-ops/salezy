"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setMessage("שליחת הקישור נכשלה. בדוק את כתובת המייל ונסה שוב.");
    } else {
      setStatus("sent");
      setMessage(`שלחנו קישור התחברות ל-${email}. בדוק את תיבת המייל.`);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-2xl font-bold text-foreground">התחברות</h1>
        <p className="mt-1 text-sm text-zinc-400">
          התחברות עם קישור קסם — בלי סיסמאות.
        </p>

        {status === "sent" ? (
          <p className="mt-6 rounded-lg bg-score-high/10 p-4 text-sm text-score-high">
            {message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-700 bg-elevated px-4 py-2.5 font-mono text-foreground placeholder-zinc-500 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {status === "sending" ? "שולח..." : "שלח לי קישור התחברות"}
            </button>
            {status === "error" && (
              <p className="text-sm text-score-low">{message}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
