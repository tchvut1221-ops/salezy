"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isAllowedAudio, MAX_FILE_BYTES } from "@/lib/constants";
import { startAnalysis } from "./actions";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const f = e.target.files?.[0] ?? null;
    if (f && !isAllowedAudio(f)) {
      setError("קובץ לא נתמך. אפשר mp3 / wav / m4a בלבד, עד 100MB.");
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const id = crypto.randomUUID();
      const path = `${user.id}/${id}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("analyses").insert({
        id,
        user_id: user.id,
        file_name: file.name,
        file_path: path,
        status: "uploaded",
      });
      if (insertError) throw insertError;

      await startAnalysis(id);
      router.push(`/analysis/${id}`);
    } catch (err) {
      console.error(err);
      setError("ההעלאה נכשלה. נסה שוב.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold text-white">העלאת שיחת מכירה</h1>
      <p className="mt-1 text-sm text-zinc-400">
        העלה הקלטה (mp3 / wav / m4a, עד {Math.round(MAX_FILE_BYTES / 1024 / 1024)}
        MB) ונתחיל לנתח אותה.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center">
        <input
          id="file"
          type="file"
          accept=".mp3,.wav,.m4a,audio/*"
          onChange={onPick}
          disabled={busy}
          className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-white hover:file:bg-emerald-500"
        />
        {file && (
          <p className="mt-4 text-sm text-zinc-300">
            נבחר: <span className="font-medium">{file.name}</span> (
            {(file.size / 1024 / 1024).toFixed(1)}MB)
          </p>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <button
        onClick={onUpload}
        disabled={!file || busy}
        className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "מעלה ומתחיל ניתוח..." : "העלה ונתח"}
      </button>
    </main>
  );
}
