export type AnalysisStatus =
  | "uploaded"
  | "converting"
  | "transcribing"
  | "analyzing"
  | "completed"
  | "failed"
  | "no_speech_detected"
  | "cancelled";

export type PersonalityType = "Analytical" | "Driver" | "Amiable" | "Expressive";

// v2 enums consumed by the enriched result components (components/salezy/) and
// produced by the hybrid analysis pipeline (lib/analysis.ts).
export type DealStage =
  | "discovery"
  | "demo"
  | "objection"
  | "negotiation"
  | "close"
  | "unknown";
export type ObjectionScore = "excellent" | "good" | "poor" | "missed";
export type MomentType =
  | "buying_signal"
  | "objection"
  | "pain_point"
  | "breakthrough";
export type NextStepPriority = "urgent" | "soon" | "when-possible";

export type ScorecardCategoryKey =
  | "opening"
  | "discovery"
  | "pitch"
  | "objectionHandling"
  | "closing";
export type TalkRatioVerdict = "optimal" | "below_optimal" | "above_optimal";
export type CoachingPriority = "high" | "medium" | "low";

export interface ScorecardCategory {
  /** 1-5, or null if not applicable (no supporting quote found in the transcript). */
  score: number | null;
  rationale: string;
  /** Verbatim transcript quote backing the score; null when score is null. */
  quote: string | null;
  /**
   * Emotional read of THIS stage, for the Stage Analysis timeline. Distinct from
   * callMetrics.sentiment (which is temporal — start/middle/end of the whole call).
   * Optional so pre-stage-analysis scorecards still satisfy the type.
   */
  sentiment?: "positive" | "neutral" | "negative";
  /**
   * Short Hebrew description of where this stage broke down, if it did.
   * null/omitted when the stage went fine.
   */
  failurePoint?: string | null;
}

/**
 * Structured output of the hybrid analysis pipeline (Claude reasoning → GPT-4o JSON).
 *
 * The three v1 blocks (customerPersonality / salespersonPerformance / customerNeeds)
 * are always present. Every v2 field is optional so that older "v1" analyses still
 * satisfy the type and the UI can degrade gracefully when a field is absent.
 */
export interface AnalysisResult {
  /** סוג אישיות הלקוח */
  customerPersonality: {
    type: PersonalityType;
    explanation: string;
    /** עד כמה ה-AI בטוח בזיהוי (0-100) */
    confidence?: number;
    /** נטייה משנית (תמהיל) — רוב האנשים אינם טיפוס טהור */
    secondaryType?: PersonalityType;
    /** קריאת שני הצירים שמהם נגזר הטיפוס */
    axes?: {
      assertiveness: "high" | "low";
      responsiveness: "task" | "people";
    };
    /** ציטוטי ראיה מהתמלול שהובילו לסיווג */
    signals?: Array<{ quote: string; interpretation: string }>;
    /** טיפים ספציפיים למכירה לאישיות הזו */
    howToSellToThisType?: string[];
    /** מה להימנע מולו */
    redFlags?: string[];
    /**
     * True when the quantitative DISC engine (lib/disc.ts) found too few
     * verified transcript signs to classify confidently. `type`/`confidence`
     * are still populated (a low-confidence best guess) but the UI should
     * show a "cannot determine" state instead of the confident headline, and
     * the flat scores.personalityType snapshot should omit this call.
     */
    indeterminate?: boolean;
    /** Raw 0-18 axis scores from the DISC engine, for transparency in the UI. */
    discAxes?: {
      formalInformal: { score: number; signalCount: number };
      dominantPassive: { score: number; signalCount: number };
    };
  };
  /** ביצועי איש המכירות */
  salespersonPerformance: {
    whatWorked: string[];
    whatDidnt: string[];
    tips: string[];
    /** ציון ביצועים כולל (0-100) */
    overallScore?: number;
    scores?: {
      needsDiscovery: number;
      objectionHandling: number;
      listeningRatio: number;
      closing: number;
    };
  };
  /** צרכי הלקוח */
  customerNeeds: {
    explicit: string[];
    implicit: string[];
    painPoints?: string[];
    priorities?: string[];
  };

  // ── v2 additions (all optional) ──
  /** TL;DR של השיחה ב-2-3 משפטים */
  executiveSummary?: string;
  /** ציון כולל לשיחה (0-100) */
  overallScore?: number;
  callObjective?: string;
  callObjectiveAchieved?: "yes" | "partial" | "no";
  dealStage?: DealStage;
  buyingSignals?: {
    positive: string[];
    negative: string[];
  };
  competitorsMentioned?: string[];
  objections?: Array<{
    objection: string;
    howHandled: string;
    score: ObjectionScore;
  }>;
  keyMoments?: Array<{
    quote: string;
    type: MomentType;
    significance: string;
  }>;
  nextSteps?: Array<{
    action: string;
    priority: NextStepPriority;
    reasoning: string;
  }>;
  /** מדדי שיחה — best-effort, תלוי באיכות זיהוי הדוברים */
  callMetrics?: {
    estimatedDurationMinutes?: number;
    /** % מזמן הדיבור של איש המכירות */
    talkRatioSalesperson?: number;
    energyLevel?: "low" | "medium" | "high";
    callPace?: "rushed" | "optimal" | "slow";
    sentiment?: {
      start: "positive" | "neutral" | "negative";
      middle: "positive" | "neutral" | "negative";
      end: "positive" | "neutral" | "negative";
    };
  };
  /**
   * Salesperson performance scorecard — SEPARATE from salespersonPerformance
   * (the existing block above) and from overallScore / salespersonPerformance.overallScore.
   * Never merge these: this is a distinct, quote-anchored, additive concept.
   */
  salespersonScorecard?: {
    opening: ScorecardCategory;
    discovery: ScorecardCategory;
    pitch: ScorecardCategory;
    objectionHandling: ScorecardCategory;
    closing: ScorecardCategory;
    /** Derived from callMetrics.talkRatioSalesperson in code — null if that wasn't estimable. */
    talkRatio: {
      repPercentage: number;
      customerPercentage: number;
      benchmarkRepPercentage: 43;
      verdict: TalkRatioVerdict;
    } | null;
    /** Average of the non-null category scores above, 2dp; null if all 5 are null. */
    overallScorecardScore: number | null;
    strengths: string[];
    improvementAreas: string[];
  };
  coachingActions?: Array<{
    action: string;
    why: string;
    how: string;
    priority: CoachingPriority;
  }>;
  weeklyFocus?: {
    primaryGoal: string;
    successMetric: string;
  };
}

/** A row of the public.analyses table. */
export interface Analysis {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  status: AnalysisStatus;
  transcript: string | null;
  result: AnalysisResult | null;
  error: string | null;
  /** "v1" = legacy 3-card result, "v2" = enriched schema. */
  analysis_version: "v1" | "v2";
  /** Flat score snapshot for cheap dashboard aggregation (v2 only). */
  scores: {
    overall: number;
    needsDiscovery?: number;
    objectionHandling?: number;
    listeningRatio?: number;
    closing?: number;
    personalityType?: PersonalityType;
  } | null;
  /**
   * Pipeline stages already completed (e.g. "transcribe", "reason") — lets a
   * resumed run (after a user-initiated stop) skip stages that already
   * finished instead of restarting from scratch. Empty for every analysis
   * that has never been stopped/resumed.
   */
  completed_steps: string[];
  /**
   * Claude's persisted free-form reasoning output, so a resumed run can skip
   * re-calling Claude when it already completed before the stop. Null until
   * that stage finishes.
   */
  reasoning: string | null;
  /**
   * When the nightly retention sweep (feat/a2-retention's lib/inngest/
   * retention.ts) removed the raw recording from Storage. Null while the
   * recording still exists. Only the audio file is auto-deleted — the
   * transcript and result stay until the user deletes the analysis.
   */
  audio_deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
