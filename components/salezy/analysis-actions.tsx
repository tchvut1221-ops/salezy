"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelAnalysis, deleteAnalysis, resumeAnalysis } from "@/app/actions";
import { Button } from "./ui";

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
    <Button variant="secondary" onClick={onClick} disabled={pending}>
      {pending ? "עוצר..." : "עצור ניתוח"}
    </Button>
  );
}

/** Shown only on a cancelled analysis, in place of Stop — continues from whichever stage already finished. */
export function ResumeAnalysisButton({ analysisId }: { analysisId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        await resumeAnalysis(analysisId);
        toast.success("ממשיך את הניתוח...");
      } catch {
        toast.error("לא הצלחנו להמשיך את הניתוח. נסו שוב.");
      }
    });
  }

  return (
    <Button onClick={onClick} disabled={pending}>
      {pending ? "ממשיך..." : "המשך ניתוח"}
    </Button>
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
  fileName,
  compact = false,
}: {
  analysisId: string;
  /** When known (e.g. a dashboard list row), makes the accessible name file-specific ("מחק ניתוח X.mp3") instead of the generic fallback. */
  fileName?: string;
  /** Smaller footprint for dense contexts (e.g. one per dashboard list row). */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const label = fileName ? `מחק ניתוח ${fileName}` : "מחק ניתוח";

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
    <Button
      variant="danger"
      size={compact ? "sm" : "md"}
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      title={label}
      className={compact ? "shrink-0" : undefined}
    >
      {compact ? (pending ? "מוחק..." : "מחק") : pending ? "מוחק..." : "מחק ניתוח"}
    </Button>
  );
}
