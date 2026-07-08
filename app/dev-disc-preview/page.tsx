import { PersonalityCard } from "@/components/salezy/personality-card";
import type { AnalysisResult } from "@/types";

/** TEMPORARY scratch route to visually verify PersonalityCard's new indeterminate
 * state + axis meters — not part of the feature, delete before merging. */

const normalCase: AnalysisResult["customerPersonality"] = {
  type: "Driver",
  secondaryType: "Expressive",
  explanation:
    "משימתי (אדום) — זוהה על בסיס 6 סימנים לשוניים בתמלול: נטייה לממוקד-משימה (9/18) ואסרטיביות גבוהה (14/18).",
  confidence: 69,
  indeterminate: false,
  axes: { assertiveness: "high", responsiveness: "task" },
  discAxes: {
    formalInformal: { score: 9, signalCount: 6 },
    dominantPassive: { score: 14, signalCount: 5 },
  },
  signals: [
    { quote: "בוא נגיע לעניין, כמה זה עולה", interpretation: "נטייה לדומיננטיות (זוג: לוקח פיקוד / מצטרף)" },
    { quote: "אין לי זמן לזה", interpretation: "נטייה לדומיננטיות (זוג: דוחף / מאופק)" },
  ],
  howToSellToThisType: ["קצר, ענייני", "לדבר תוצאות, שורה תחתונה"],
  redFlags: ["בלי קשקושים", "לא לבזבז לו את הזמן"],
};

const indeterminateCase: AnalysisResult["customerPersonality"] = {
  type: "Analytical",
  explanation: 'נמצאו מעט מדי סימנים לשוניים בתמלול (2 סה"כ) כדי לקבוע סגנון תקשורת בביטחון.',
  confidence: 38,
  indeterminate: true,
  discAxes: {
    formalInformal: { score: 9, signalCount: 1 },
    dominantPassive: { score: 9, signalCount: 1 },
  },
};

export default function DiscPreviewPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <div>
        <h2 className="mb-3 text-sm text-zinc-500">Normal case (Driver + Expressive blend)</h2>
        <PersonalityCard personality={normalCase} />
      </div>
      <div>
        <h2 className="mb-3 text-sm text-zinc-500">Indeterminate case</h2>
        <PersonalityCard personality={indeterminateCase} />
      </div>
    </div>
  );
}
