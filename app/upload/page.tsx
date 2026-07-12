"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { isAllowedAudio, MAX_FILE_BYTES } from "@/lib/constants";
import { AUDIO_RETENTION_DAYS } from "@/lib/retention-policy";
import { startAnalysis } from "./actions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * `File.name` is attacker-controlled (it's just a JS string property that
 * can be set arbitrarily, e.g. via a crafted File/Blob) and is embedded
 * verbatim in the Storage object path below. Strip it down to a safe
 * basename so it can't introduce extra path segments ("/", "..") or other
 * characters Supabase Storage object keys don't allow.
 */
function sanitizeFileNameForPath(name: string): string {
  const base = name.split(/[/\\]/).pop() || "file";
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "file";
}

/**
 * Resumable (TUS) upload to Supabase Storage. The plain `.upload()` is
 * unreliable for large files (it would silently stall on a 39MB call); the
 * resumable protocol chunks the file, retries on failure, and reports progress.
 */
function resumableUpload(opts: {
  file: File;
  path: string;
  token: string;
  onProgress: (pct: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(opts.file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${opts.token}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "recordings",
        objectName: opts.path,
        contentType: opts.file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024, // Supabase requires 6MB chunks
      onError: reject,
      onProgress: (sent, total) => {
        if (total) opts.onProgress(Math.round((sent / total) * 100));
      },
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const f = e.target.files?.[0] ?? null;
    if (f && !isAllowedAudio(f)) {
      setError(
        `קובץ לא נתמך. אפשר mp3 / wav / m4a / mp4 / mov / ogg / aac / webm / flac, עד ${Math.round(
          MAX_FILE_BYTES / 1024 / 1024
        )}MB.`
      );
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress(0);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const id = crypto.randomUUID();
      const path = `${session.user.id}/${id}/${sanitizeFileNameForPath(file.name)}`;

      await resumableUpload({
        file,
        path,
        token: session.access_token,
        onProgress: setProgress,
      });

      const { error: insertError } = await supabase.from("analyses").insert({
        id,
        user_id: session.user.id,
        file_name: file.name,
        file_path: path,
        status: "uploaded",
      });
      if (insertError) throw insertError;

      await startAnalysis(id);
      router.push(`/analysis/${id}`);
    } catch (err) {
      console.error(err);
      toast.error("ההעלאה נכשלה. בדקו את החיבור ונסו שוב.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold text-foreground">העלאת שיחת מכירה</h1>
      <p className="mt-1 text-sm text-zinc-400">
        העלה הקלטה (mp3 / wav / m4a / mp4 / mov / ogg / aac / webm / flac, עד{" "}
        {Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB) ונתחיל לנתח אותה.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        קובץ ההקלטה נמחק מהשרתים אוטומטית {AUDIO_RETENTION_DAYS} יום לאחר
        ההעלאה. התמלול והניתוח נשמרים עד שתמחקו אותם.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center">
        <input
          id="file"
          type="file"
          accept=".mp3,.wav,.m4a,.mp4,.mov,.ogg,.aac,.webm,.flac,audio/*,video/mp4,video/quicktime"
          onChange={onPick}
          disabled={busy}
          className="block w-full text-sm text-zinc-300 file:me-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground file:transition-colors hover:file:bg-primary/90"
        />
        {file && (
          <p className="mt-4 text-sm text-zinc-300">
            נבחר: <span className="font-medium">{file.name}</span>{" "}
            <span dir="ltr" className="font-mono text-zinc-400">
              ({(file.size / 1024 / 1024).toFixed(1)}MB)
            </span>
          </p>
        )}
      </div>

      {busy && (
        <div className="mt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-zinc-400">
            {progress < 100 ? (
              <>
                מעלה...{" "}
                <span dir="ltr" className="font-mono">
                  {progress}%
                </span>
              </>
            ) : (
              "ההעלאה הושלמה, מתחיל ניתוח..."
            )}
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-score-low">{error}</p>}

      <button
        onClick={onUpload}
        disabled={!file || busy}
        className="mt-6 w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? "מעלה ומתחיל ניתוח..." : "העלה ונתח"}
      </button>
    </main>
  );
}
