export type AnalysisStatus =
  | "uploaded"
  | "transcribing"
  | "analyzing"
  | "completed"
  | "failed";

export type PersonalityType = "Analytical" | "Driver" | "Amiable" | "Expressive";

/** Structured output of the GPT-4o analysis (3 focus areas). */
export interface AnalysisResult {
  /** סוג אישיות הלקוח */
  customerPersonality: {
    type: PersonalityType;
    explanation: string;
  };
  /** ביצועי איש המכירות */
  salespersonPerformance: {
    whatWorked: string[];
    whatDidnt: string[];
    tips: string[];
  };
  /** צרכי הלקוח */
  customerNeeds: {
    explicit: string[];
    implicit: string[];
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
  created_at: string;
  updated_at: string;
}
