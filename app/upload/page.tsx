"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAllowedAudio, MAX_FILE_BYTES } from "@/lib/constants";
import { Button } from "@/components/salezy/ui";
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
  const [isDragging, setIsDragging] = useState(false);

  // Shared by the native file input and the drop handler so both paths run
  // the exact same validation.
  function validateAndSetFile(f: File | null) {
    setError("");
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

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    validateAndSetFile(e.target.files?.[0] ?? null);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!busy) setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (busy) return;
    validateAndSetFile(e.dataTransfer.files?.[0] ?? null);
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
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-4 py-12 outline-none">
      <h1 className="text-2xl font-bold text-foreground">העלאת שיחת מכירה</h1>
      <p className="mt-1 text-sm text-zinc-400">
        העלה הקלטה (mp3 / wav / m4a / mp4 / mov / ogg / aac / webm / flac, עד{" "}
        {Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB) ונתחיל לנתח אותה.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        קובץ ההקלטה נמחק מהשרתים אוטומטית {AUDIO_RETENTION_DAYS} יום לאחר
        ההעלאה. התמלול והניתוח נשמרים עד שתמחקו אותם.
      </p>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mt-8 rounded-xl border border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-zinc-700 bg-zinc-900"
        }`}
      >
        <UploadCloud
          className={`mx-auto h-8 w-8 ${isDragging ? "text-primary" : "text-zinc-500"}`}
          strokeWidth={1.5}
        />
        <p className="mt-2 text-sm text-zinc-400">גררו קובץ לכאן, או</p>
        <label htmlFor="file" className="sr-only">
          בחירת קובץ הקלטה
        </label>
        <input
          id="file"
          type="file"
          accept=".mp3,.wav,.m4a,.mp4,.mov,.ogg,.aac,.webm,.flac,audio/*,video/mp4,video/quicktime"
          onChange={onPick}
          disabled={busy}
          className="mx-auto mt-2 block text-sm text-zinc-300 file:me-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground file:transition-colors hover:file:bg-primary/90"
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
        <div className="mt-6" role="status" aria-live="polite">
          <div
            role="progressbar"
            aria-label="התקדמות העלאה"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-800"
          >
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

      {error && (
        <p role="alert" className="mt-4 text-sm text-score-low">
          {error}
        </p>
      )}

      <Button
        onClick={onUpload}
        disabled={!file || busy}
        size="lg"
        className="mt-6 w-full"
      >
        {busy ? "מעלה ומתחיל ניתוח..." : "העלה ונתח"}
      </Button>
    </main>
  );
}
