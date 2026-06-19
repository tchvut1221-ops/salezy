import type { createClient } from "@/lib/supabase/server";
import type { PersonalityType } from "@/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** A single v2 call's score snapshot, as needed by the dashboard charts. */
export interface ScorePoint {
  id: string;
  created_at: string;
  overall: number;
  personalityType?: PersonalityType;
}

export interface AnalyticsStats {
  /** Total number of v2 calls with a score (this is what the chart plots too). */
  callCount: number;
  /** Average of `scores.overall` across all v2 calls. */
  averageScore: number;
  /**
   * Improvement delta: average score of the most recent half of calls minus
   * the average score of the older half (chronological split down the middle).
   * With an odd count the extra call goes to the "recent" half. Null when
   * there are fewer than 2 calls (nothing to compare).
   */
  improvementDelta: number | null;
  /** Most frequent `personalityType` across v2 calls that have one set. Null if none do. */
  mostCommonPersonality: PersonalityType | null;
}

/**
 * Fetches this user's v2, scored analyses (oldest -> newest) using the
 * RLS-respecting server client. Selects only `id, created_at, scores` — never
 * the full `result` blob — per the Stage C spec (aggregate over `scores` jsonb).
 *
 * RLS on `public.analyses` (auth.uid() = user_id) is what actually guarantees
 * user-scoping; the `.eq("user_id", ...)` below is defense-in-depth on top of
 * that, not a substitute for it.
 */
export async function fetchScorePoints(
  supabase: SupabaseServerClient,
  userId: string
): Promise<ScorePoint[]> {
  const { data, error } = await supabase
    .from("analyses")
    .select("id, created_at, scores")
    .eq("user_id", userId)
    .eq("analysis_version", "v2")
    .not("scores", "is", null)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  type Row = {
    id: string;
    created_at: string;
    scores: { overall: number; personalityType?: PersonalityType } | null;
  };

  return (data as Row[])
    .filter((row) => row.scores != null && typeof row.scores.overall === "number")
    .map((row) => ({
      id: row.id,
      created_at: row.created_at,
      overall: row.scores!.overall,
      personalityType: row.scores!.personalityType,
    }));
}

/** Pure aggregation over already-fetched score points — no I/O, easy to unit-trace. */
export function computeStats(points: ScorePoint[]): AnalyticsStats {
  const callCount = points.length;

  if (callCount === 0) {
    return {
      callCount: 0,
      averageScore: 0,
      improvementDelta: null,
      mostCommonPersonality: null,
    };
  }

  const averageScore =
    points.reduce((sum, p) => sum + p.overall, 0) / callCount;

  let improvementDelta: number | null = null;
  if (callCount >= 2) {
    const splitIndex = Math.floor(callCount / 2);
    const olderHalf = points.slice(0, splitIndex);
    const recentHalf = points.slice(splitIndex);
    const avg = (arr: ScorePoint[]) =>
      arr.reduce((sum, p) => sum + p.overall, 0) / arr.length;
    improvementDelta = avg(recentHalf) - avg(olderHalf);
  }

  const counts = new Map<PersonalityType, number>();
  for (const p of points) {
    if (!p.personalityType) continue;
    counts.set(p.personalityType, (counts.get(p.personalityType) ?? 0) + 1);
  }
  let mostCommonPersonality: PersonalityType | null = null;
  let bestCount = 0;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      mostCommonPersonality = type;
    }
  }

  return { callCount, averageScore, improvementDelta, mostCommonPersonality };
}
