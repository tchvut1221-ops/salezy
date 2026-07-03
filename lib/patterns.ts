import type { createClient } from "@/lib/supabase/server";
import type { AnalysisResult, DealStage, ScorecardCategoryKey } from "@/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface ScoredCall {
  id: string;
  createdAt: string;
  scorecard: NonNullable<AnalysisResult["salespersonScorecard"]>;
  nextStepsCount: number;
  dealStage?: DealStage;
}

export interface PatternFinding {
  id: string;
  message: string;
}

export interface CategoryAverage {
  key: ScorecardCategoryKey;
  label: string;
  average: number | null;
  scoredCallCount: number;
}

export interface TalkRatioStats {
  average: number;
  stdDev: number;
  consistency: "stable" | "somewhat_variable" | "highly_variable";
}

export type PatternsData =
  | { eligible: false; callCount: number }
  | {
      eligible: true;
      callCount: number;
      categoryAverages: CategoryAverage[];
      talkRatioStats: TalkRatioStats | null;
      findings: PatternFinding[];
      coaching: { finding: PatternFinding; action: string; how: string } | null;
      trend: Array<{ createdAt: string; overall: number | null }>;
    };

const MIN_CALLS_FOR_PATTERN = 3;
const CATEGORIES: ScorecardCategoryKey[] = [
  "opening",
  "discovery",
  "pitch",
  "objectionHandling",
  "closing",
];
const CATEGORY_LABELS: Record<ScorecardCategoryKey, string> = {
  opening: "פתיחה",
  discovery: "גילוי צרכים",
  pitch: "הצגת פתרון",
  objectionHandling: "טיפול בהתנגדויות",
  closing: "סגירה",
};

/** Average score per category across calls that have that category scored. */
export function computeCategoryAverages(calls: ScoredCall[]): CategoryAverage[] {
  return CATEGORIES.map((key) => {
    const scored = calls
      .map((c) => c.scorecard[key].score)
      .filter((s): s is number => typeof s === "number");
    return {
      key,
      label: CATEGORY_LABELS[key],
      average:
        scored.length > 0
          ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100
          : null,
      scoredCallCount: scored.length,
    };
  });
}

/** Talk-ratio average + population stddev-based consistency read. */
export function computeTalkRatioStats(calls: ScoredCall[]): TalkRatioStats | null {
  const values = calls
    .map((c) => c.scorecard.talkRatio?.repPercentage)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  // Consistency bands: stdDev<5pp = stable, 5-10 = somewhat variable, >10 = highly variable.
  // Starting thresholds — reasonable given a 0-100 scale, tunable once real usage data exists.
  const consistency: TalkRatioStats["consistency"] =
    stdDev < 5 ? "stable" : stdDev < 10 ? "somewhat_variable" : "highly_variable";

  return { average: Math.round(avg * 10) / 10, stdDev: Math.round(stdDev * 10) / 10, consistency };
}

function detectEarlyPitchPattern(calls: ScoredCall[]): PatternFinding | null {
  const eligible = calls.filter(
    (c) => c.scorecard.pitch.score != null && c.scorecard.discovery.score != null
  );
  if (eligible.length < MIN_CALLS_FOR_PATTERN) return null;

  const earlyPitchCalls = eligible.filter(
    (c) => (c.scorecard.discovery.score ?? 0) <= 2 && (c.scorecard.pitch.score ?? 0) >= 3
  );
  const pct = Math.round((earlyPitchCalls.length / eligible.length) * 100);
  if (pct < 30) return null;

  return {
    id: "early-pitch",
    message: `ב-${pct}% מהשיחות שלך יש קפיצה להצגת פתרון לפני שגילוי הצרכים הושלם. נסה להאריך את שלב הגילוי לפני שאתה עובר להצגה.`,
  };
}

function detectTalkRatioNoNextSteps(calls: ScoredCall[]): PatternFinding | null {
  const withRatio = calls.filter((c) => c.scorecard.talkRatio != null);
  if (withRatio.length < MIN_CALLS_FOR_PATTERN) return null;

  const withNextSteps = withRatio.filter((c) => c.nextStepsCount > 0);
  const withoutNextSteps = withRatio.filter((c) => c.nextStepsCount === 0);
  if (withoutNextSteps.length === 0 || withNextSteps.length === 0) return null;

  const avg = (arr: ScoredCall[]) =>
    arr.reduce((s, c) => s + (c.scorecard.talkRatio?.repPercentage ?? 0), 0) / arr.length;
  const avgWith = avg(withNextSteps);
  const avgWithout = avg(withoutNextSteps);
  const diff = avgWithout - avgWith;
  if (diff < 8) return null;

  return {
    id: "talk-ratio-no-next-steps",
    message: `בשיחות שמסתיימות בלי צעדים הבאים ברורים, יחס הדיבור שלך גבוה יותר בממוצע ב-${Math.round(diff)} נקודות אחוז (${Math.round(avgWithout)}% מול ${Math.round(avgWith)}%).`,
  };
}

function detectWeakClosingHighTalk(calls: ScoredCall[]): PatternFinding | null {
  const eligible = calls.filter(
    (c) => c.scorecard.closing.score != null && c.scorecard.talkRatio != null
  );
  if (eligible.length < MIN_CALLS_FOR_PATTERN) return null;

  const weak = eligible.filter((c) => (c.scorecard.closing.score ?? 0) <= 2);
  const strong = eligible.filter((c) => (c.scorecard.closing.score ?? 0) >= 4);
  if (weak.length === 0 || strong.length === 0) return null;

  const avg = (arr: ScoredCall[]) =>
    arr.reduce((s, c) => s + (c.scorecard.talkRatio?.repPercentage ?? 0), 0) / arr.length;
  const avgWeak = avg(weak);
  const avgStrong = avg(strong);
  const diff = avgWeak - avgStrong;
  if (diff < 8) return null;

  return {
    id: "weak-closing-high-talk",
    message: `בשיחות עם ציון סגירה נמוך (1-2), יחס הדיבור הממוצע שלך גבוה ב-${Math.round(diff)} נקודות אחוז לעומת שיחות עם סגירה חזקה (4-5) — ${Math.round(avgWeak)}% מול ${Math.round(avgStrong)}%.`,
  };
}

function detectConsistentWeakCategory(calls: ScoredCall[]): PatternFinding | null {
  if (calls.length < MIN_CALLS_FOR_PATTERN) return null;

  let worstKey: ScorecardCategoryKey | null = null;
  let worstPct = 0;
  for (const key of CATEGORIES) {
    const scored = calls.filter((c) => c.scorecard[key].score != null);
    if (scored.length < MIN_CALLS_FOR_PATTERN) continue;
    const weakCount = scored.filter((c) => (c.scorecard[key].score ?? 0) <= 2).length;
    const pct = weakCount / scored.length;
    if (pct > worstPct) {
      worstPct = pct;
      worstKey = key;
    }
  }
  if (!worstKey || worstPct < 0.4) return null;

  return {
    id: "consistent-weak-category",
    message: `הקטגוריה "${CATEGORY_LABELS[worstKey]}" מקבלת ציון נמוך (1-2) ב-${Math.round(worstPct * 100)}% מהשיחות שנותחו — זהו דפוס חוזר, לא מקרה בודד.`,
  };
}

/** Ordered by priority; each detector uses a real numeric threshold (not a placeholder),
 * chosen to avoid flagging small-N flukes — starting values, tunable with real usage. */
export function detectPatterns(calls: ScoredCall[]): PatternFinding[] {
  const detectors = [
    detectConsistentWeakCategory,
    detectEarlyPitchPattern,
    detectTalkRatioNoNextSteps,
    detectWeakClosingHighTalk,
  ];
  return detectors
    .map((fn) => fn(calls))
    .filter((f): f is PatternFinding => f != null)
    .slice(0, 4);
}

const COACHING_FOR_PATTERN: Record<string, { action: string; how: string }> = {
  "consistent-weak-category": {
    action: "התמקד השבוע בקטגוריה החלשה ביותר שזוהתה",
    how: "בכל שיחה השבוע, הקדש תשומת לב מודעת לקטגוריה הזו לפני שאתה מתחיל.",
  },
  "early-pitch": {
    action: "האריך את שלב הגילוי לפני מעבר להצגת פתרון",
    how: "קבע לעצמך כלל: לפחות 4 שאלות פתוחות לפני שאתה מציג כל פתרון.",
  },
  "talk-ratio-no-next-steps": {
    action: "סיים כל שיחה בבקשה מפורשת לצעד הבא",
    how: "לפני שאתה מסיים שיחה, עצור ושאל: 'מה הצעד הבא ומתי?'",
  },
  "weak-closing-high-talk": {
    action: "קצר את הדיבור שלך בשלב הסגירה ותן ללקוח להוביל",
    how: "בשלב הסגירה, שאל שאלה ואז שתוק — תן ללקוח למלא את השקט.",
  },
};

/**
 * Queries this user's completed, scorecard-bearing analyses and composes the
 * full /patterns payload. Called directly by the server component (no extra
 * HTTP round trip) AND by app/api/patterns/route.ts (same rationale as
 * lib/analytics.ts / app/api/analytics/route.ts) — single source of truth,
 * two callers.
 */
export async function getPatternsData(
  supabase: SupabaseServerClient,
  userId: string
): Promise<PatternsData> {
  const { data } = await supabase
    .from("analyses")
    .select("id, created_at, result")
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("result", "is", null)
    .order("created_at", { ascending: true });

  type Row = { id: string; created_at: string; result: AnalysisResult | null };
  const rows = (data ?? []) as Row[];

  const scoredCalls: ScoredCall[] = rows
    .filter((row) => row.result?.salespersonScorecard != null)
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      scorecard: row.result!.salespersonScorecard!,
      nextStepsCount: row.result!.nextSteps?.length ?? 0,
      dealStage: row.result!.dealStage,
    }));

  if (scoredCalls.length < MIN_CALLS_FOR_PATTERN) {
    return { eligible: false, callCount: scoredCalls.length };
  }

  const findings = detectPatterns(scoredCalls);
  return {
    eligible: true,
    callCount: scoredCalls.length,
    categoryAverages: computeCategoryAverages(scoredCalls),
    talkRatioStats: computeTalkRatioStats(scoredCalls),
    findings,
    coaching: findings[0]
      ? { finding: findings[0], ...COACHING_FOR_PATTERN[findings[0].id] }
      : null,
    trend: scoredCalls.map((c) => ({
      createdAt: c.createdAt,
      overall: c.scorecard.overallScorecardScore,
    })),
  };
}
