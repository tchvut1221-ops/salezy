"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelAnalysis, deleteAnalysis } from "@/app/actions";

/** Shown only while an analysis is still running (next to the progress indicator). */
export function StopAnalysisButton({ analysisId }: { analysisId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !window.confirm(
        "לעצור את הניתוח? הפעולה תפסיק את העיבוד מיד ולא ניתן לבטל אותה."
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await cancelAnalysis(analysisId);
        toast.success("הניתוח נעצר.");
      } catch {
        toast.error("לא הצלחנו לעצור את הניתוח. נסו שוב.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-foreground disabled:opacity-50"
    >
      {pending ? "עוצר..." : "עצור ניתוח"}
    </button>
  );
}

/**
 * Shown on every analysis regardless of status. Navigates to /dashboard on
 * success rather than redirecting inside the server action itself — Next.js's
 * redirect() throws a control-flow signal that a surrounding try/catch (used
 * here to show an error toast) would otherwise swallow as a generic failure.
 */
export function DeleteAnalysisButton({
  analysisId,
  compact = false,
}: {
  analysisId: string;
  /** Smaller footprint for dense contexts (e.g. one per dashboard list row). */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        "למחוק את הניתוח לצמיתות? הקובץ והנתונים יימחקו ולא ניתן לשחזר אותם."
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteAnalysis(analysisId);
        toast.success("הניתוח נמחק.");
        router.push("/dashboard");
        router.refresh();
      } catch {
        toast.error("לא הצלחנו למחוק את הניתוח. נסו שוב.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="מחק ניתוח"
      title="מחק ניתוח"
      className={
        compact
          ? "shrink-0 rounded-lg border border-score-low/30 px-2.5 py-1.5 text-xs font-medium text-score-low transition hover:bg-score-low/10 disabled:opacity-50"
          : "rounded-lg border border-score-low/30 px-4 py-2 text-sm font-medium text-score-low transition hover:bg-score-low/10 disabled:opacity-50"
      }
    >
      {compact ? (pending ? "מוחק..." : "מחק") : pending ? "מוחק..." : "מחק ניתוח"}
    </button>
  );
}
