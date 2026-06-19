"use client";

import { useEffect, useState } from "react";
import type { AnalysisStatus } from "@/types";

/**
 * Status-appropriate rotating Hebrew copy + a rough ETA, shown while an analysis
 * is in flight. Keeps the page feeling alive during the (multi-minute) wait instead
 * of a single static line. Purely cosmetic — does not affect real status, which
 * still comes from the realtime subscription in the parent.
 */
const MESSAGES_BY_STATUS: Record<AnalysisStatus, string[]> = {
  uploaded: ["מכין את הקובץ...", "בודק את ההקלטה..."],
  converting: ["ממיר את הקובץ לפורמט שמע...", "מכין את השמע לתמלול..."],
  transcribing: ["מתמלל...", "מזהה דוברים בשיחה...", "כמעט סיימנו לתמלל..."],
  analyzing: [
    "מנתח אישיות...",
    "מחשב ציון ביצועים...",
    "מאתר רגעי מפתח בשיחה...",
    "מכין המלצות...",
    "מסכם את השיחה...",
  ],
  completed: ["מוכן!"],
  failed: [],
};

const ETA_BY_STATUS: Record<AnalysisStatus, string> = {
  uploaded: "ההמרה תתחיל בעוד כמה שניות",
  converting: "~3-5 דק' לשיחה של 20 דק'",
  transcribing: "~3-5 דק' לשיחה של 20 דק'",
  analyzing: "כמעט סיימנו — עוד דקה-שתיים",
  completed: "",
  failed: "",
};

export function LoadingMessages({ status }: { status: AnalysisStatus }) {
  const messages = MESSAGES_BY_STATUS[status];
  const [index, setIndex] = useState(0);

  // Reset to the first message whenever the status itself changes, then rotate
  // through that status's messages on a fixed interval.
  useEffect(() => {
    setIndex(0);
  }, [status]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 2500);
    return () => clearInterval(id);
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="mt-6 text-center">
      <p className="animate-pulse text-sm text-zinc-400">{messages[index]}</p>
      {ETA_BY_STATUS[status] && (
        <p className="mt-1 text-xs text-zinc-600">{ETA_BY_STATUS[status]}</p>
      )}
    </div>
  );
}
