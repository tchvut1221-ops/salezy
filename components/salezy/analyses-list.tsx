import Link from "next/link";
import { Pill, scoreColor } from "./ui";
import { DeleteAnalysisButton } from "./analysis-actions";
import type { AnalysisStatus } from "@/types";

export type AnalysisListItem = {
  id: string;
  file_name: string;
  status: AnalysisStatus;
  created_at: string;
  scores: { overall: number } | null;
};

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  uploaded: "בתור",
  converting: "ממיר קובץ",
  transcribing: "מתמלל",
  analyzing: "מנתח",
  completed: "מוכן",
  failed: "נכשל",
  no_speech_detected: "לא זוהה דיבור",
  cancelled: "בוטל",
};

// Status → Pill tone. In-progress states share the amber "warn" tone; the
// terminal states get their semantic colors.
const STATUS_TONE: Record<
  AnalysisStatus,
  "neutral" | "positive" | "negative" | "warn"
> = {
  uploaded: "neutral",
  converting: "warn",
  transcribing: "warn",
  analyzing: "warn",
  completed: "positive",
  failed: "negative",
  no_speech_detected: "negative",
  cancelled: "neutral",
};

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * The user's calls, newest first. Lifted verbatim out of the dashboard page in
 * D2 (same row markup, same links, same delete control) so the page file can
 * be about composing widgets — the list's own behaviour is unchanged and
 * deliberately wasn't rebuilt.
 */
export function AnalysesList({ analyses }: { analyses: AnalysisListItem[] }) {
  return (
    <ul className="space-y-3">
      {analyses.map((a, i) => {
        const score = a.scores?.overall;
        const sc = typeof score === "number" ? scoreColor(score) : null;
        return (
          <li
            key={a.id}
            className="animate-fade-up flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 transition hover:border-zinc-700 hover:bg-zinc-800/40 sm:px-5 sm:py-4"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <Link
              href={`/analysis/${a.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-zinc-200">{a.file_name}</span>
                <span
                  dir="ltr"
                  className="mt-0.5 block text-right font-mono text-xs tabular-nums text-zinc-500 sm:text-left"
                >
                  {dateFmt.format(new Date(a.created_at))}
                </span>
              </div>

              {sc && typeof score === "number" && (
                <span
                  dir="ltr"
                  className={`font-mono text-lg font-bold tabular-nums ${sc.text}`}
                  title="ציון השיחה"
                >
                  {Math.round(score)}
                </span>
              )}

              <Pill tone={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Pill>
            </Link>

            <DeleteAnalysisButton analysisId={a.id} fileName={a.file_name} compact />
          </li>
        );
      })}
    </ul>
  );
}
