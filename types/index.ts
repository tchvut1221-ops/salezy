export type AnalysisStatus =
  | "uploaded"
  | "converting"
  | "transcribing"
  | "analyzing"
  | "completed"
  | "failed"
  | "no_speech_detected";

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
  created_at: string;
  updated_at: string;
}
