import { z } from "zod";
import type { AiAdapter, GetStepTools } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { parseModelJson } from "@/lib/analysis";
import {
  FORMAL_INFORMAL_PAIRS,
  DOMINANT_PASSIVE_PAIRS,
  STYLE_PROFILES,
  QUADRANT_MAP,
  renderDiscPrompt,
} from "@/lib/disc-reference";
import type { AnalysisResult, PersonalityType } from "@/types";

type DiscStep = GetStepTools<typeof inngest>;

const signSchema = (maxPair: number) =>
  z.object({
    quote: z.string().min(1),
    pairNumber: z.number().int().min(1).max(maxPair),
  });

const rawDiscSchema = z.object({
  formalInformalSigns: z
    .array(signSchema(FORMAL_INFORMAL_PAIRS.length).extend({ pole: z.enum(["formal", "informal"]) }))
    .catch([]),
  dominantPassiveSigns: z
    .array(signSchema(DOMINANT_PASSIVE_PAIRS.length).extend({ pole: z.enum(["dominant", "passive"]) }))
    .catch([]),
});

export type RawDiscSigns = z.infer<typeof rawDiscSchema>;

const EMPTY_RAW_SIGNS: RawDiscSigns = { formalInformalSigns: [], dominantPassiveSigns: [] };

/** claude-sonnet-4-6, temperature 0, no extended thinking — the model id/params shared by both call sites below. */
export const DISC_MODEL_ID = "claude-sonnet-4-6";

/**
 * The exact request shape for the focused DISC sign-detection call: a single
 * narrow job (detect quote-anchored signs against the two word-pair
 * questionnaires in lib/disc-reference.ts), temperature 0, no extended
 * thinking. Unlike reasonAboutCall's adaptive-thinking free-form call, this is
 * the consistency lever — a narrow, deterministic-as-possible sampling config
 * for the one field (DISC type) that was flip-flopping between runs.
 *
 * Shared between scoreDiscAxes() (dispatched via Inngest's step.ai.infer, the
 * production path) and scripts/disc-stability.ts (dispatched via the raw
 * Anthropic SDK, since step.ai.infer requires a live Inngest function
 * execution context that a standalone script doesn't have) — so both call
 * sites send Claude the identical prompt/params.
 */
export function buildDiscRequestBody(transcript: string) {
  return {
    system: renderDiscPrompt(),
    messages: [
      { role: "user" as const, content: `הנה תמלול השיחה:\n\n${transcript}` },
    ],
    max_tokens: 4096,
    temperature: 0,
  };
}

/**
 * Parses + validates + anti-fabrication-filters a raw model text response into
 * RawDiscSigns. Shared by both call sites for the same reason as
 * buildDiscRequestBody above.
 */
export function parseDiscResponse(text: string, transcript: string): RawDiscSigns {
  if (!text) return EMPTY_RAW_SIGNS;

  let raw: unknown;
  try {
    raw = parseModelJson(text);
  } catch {
    // A failed DISC scoring pass degrades to "no signs found" (→ indeterminate
    // downstream) rather than failing the whole analysis pipeline over a
    // secondary, non-critical dimension.
    return EMPTY_RAW_SIGNS;
  }

  const parsed = rawDiscSchema.safeParse(raw);
  if (!parsed.success) return EMPTY_RAW_SIGNS;
  return filterVerbatimSigns(parsed.data, transcript);
}

/**
 * Calls Claude once via Inngest's step.ai.infer (an Inngest step itself, so —
 * like reasonAboutCall — this must NOT be nested inside another step.run) and
 * runs the response through parseDiscResponse.
 */
export async function scoreDiscAxes(
  transcript: string,
  step: DiscStep
): Promise<RawDiscSigns> {
  const model = step.ai.models.anthropic({
    model: DISC_MODEL_ID,
    defaultParameters: { max_tokens: 4096 },
  });
  const body = buildDiscRequestBody(transcript) as AiAdapter.Input<typeof model>;
  const res = await step.ai.infer("score-disc", { model, body });

  const text = res.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return parseDiscResponse(text, transcript);
}

/** Strips Hebrew niqqud/cantillation and common punctuation for loose substring matching. */
function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'׳״.,!?;:()\-–—]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Anti-fabrication gate, mirroring normalizeScorecard()'s pattern in
 * lib/analysis.ts: a detected sign is only trusted if its quote can actually be
 * found (loosely normalized) in the transcript. Drops anything the model
 * asserts but didn't actually quote verbatim.
 */
function filterVerbatimSigns(raw: RawDiscSigns, transcript: string): RawDiscSigns {
  const normalizedTranscript = normalizeForMatch(transcript);
  const isVerbatim = (quote: string) => {
    const q = normalizeForMatch(quote);
    return q.length >= 2 && normalizedTranscript.includes(q);
  };
  return {
    formalInformalSigns: raw.formalInformalSigns.filter((s) => isVerbatim(s.quote)),
    dominantPassiveSigns: raw.dominantPassiveSigns.filter((s) => isVerbatim(s.quote)),
  };
}

// ── Deterministic scoring (pure — no LLM calls below this point) ──

/** Below this many total verified signs (across both axes), the call is indeterminate. */
const MIN_TOTAL_SIGNALS = 4;
/** Confidence floor below which a result is indeterminate even if signal count passed. */
const INDETERMINATE_CONFIDENCE_FLOOR = 45;
/** Signal count at which density stops adding to confidence (diminishing returns). */
const SIGNAL_TARGET_FOR_FULL_DENSITY = 10;
/** How close to a 50/50 split (as a fraction of that axis's total) still counts as "contested" for blend detection. */
const BLEND_MARGIN_RATIO_THRESHOLD = 0.34;

export interface AxisReading {
  /** 0-18, midpoint 9. Higher = more of the named "high" pole. */
  score: number;
  signalCount: number;
}

export interface DiscComputation {
  type: PersonalityType;
  secondaryType?: PersonalityType;
  confidence: number;
  indeterminate: boolean;
  axes: { assertiveness: "high" | "low"; responsiveness: "task" | "people" };
  discAxes: {
    formalInformal: AxisReading;
    dominantPassive: AxisReading;
  };
  signals: Array<{ quote: string; interpretation: string }>;
  explanation: string;
  howToSellToThisType: string[];
  redFlags: string[];
}

/** score 0-18, midpoint 9. highCount wins → toward 18, lowCount wins → toward 0. */
function axisScore(highCount: number, lowCount: number): number {
  const total = highCount + lowCount;
  if (total === 0) return 9;
  const raw = 9 + Math.round(9 * ((highCount - lowCount) / total));
  return Math.max(0, Math.min(18, raw));
}

function isContested(highCount: number, lowCount: number): boolean {
  const total = highCount + lowCount;
  if (total === 0) return false;
  return Math.abs(highCount - lowCount) / total <= BLEND_MARGIN_RATIO_THRESHOLD;
}

/**
 * Pure, deterministic mapping from detected signs → DISC quadrant + confidence.
 * No LLM involved — this is the piece that makes repeated runs on the same
 * transcript converge to the same answer, replacing the old holistic judgment
 * that could flip between adjacent types run to run.
 */
export function computeDiscResult(raw: RawDiscSigns): DiscComputation {
  const formalCount = raw.formalInformalSigns.filter((s) => s.pole === "formal").length;
  const informalCount = raw.formalInformalSigns.filter((s) => s.pole === "informal").length;
  const dominantCount = raw.dominantPassiveSigns.filter((s) => s.pole === "dominant").length;
  const passiveCount = raw.dominantPassiveSigns.filter((s) => s.pole === "passive").length;

  const formalInformalScore = axisScore(formalCount, informalCount);
  const dominantPassiveScore = axisScore(dominantCount, passiveCount);

  const responsiveness: "task" | "people" = formalCount >= informalCount ? "task" : "people";
  const assertiveness: "high" | "low" = dominantCount >= passiveCount ? "high" : "low";

  const type = QUADRANT_MAP[assertiveness][responsiveness];

  let secondaryType: PersonalityType | undefined;
  const responsivenessContested = isContested(formalCount, informalCount);
  const assertivenessContested = isContested(dominantCount, passiveCount);
  if (responsivenessContested !== assertivenessContested) {
    // Exactly one axis is a near-tie with real (non-zero) evidence on both sides —
    // flip just that axis to name the adjacent quadrant as the blend.
    const flippedResponsiveness: "task" | "people" =
      responsiveness === "task" ? "people" : "task";
    const flippedAssertiveness: "high" | "low" = assertiveness === "high" ? "low" : "high";
    secondaryType = responsivenessContested
      ? QUADRANT_MAP[assertiveness][flippedResponsiveness]
      : QUADRANT_MAP[flippedAssertiveness][responsiveness];
    if (secondaryType === type) secondaryType = undefined;
  }

  const totalSignals =
    raw.formalInformalSigns.length + raw.dominantPassiveSigns.length;
  const formalInformalTotal = formalCount + informalCount;
  const dominantPassiveTotal = dominantCount + passiveCount;
  const marginF = formalInformalTotal > 0 ? Math.abs(formalCount - informalCount) / formalInformalTotal : 0;
  const marginD = dominantPassiveTotal > 0 ? Math.abs(dominantCount - passiveCount) / dominantPassiveTotal : 0;
  const avgMargin = (marginF + marginD) / 2;
  const densityFactor = Math.min(1, totalSignals / SIGNAL_TARGET_FOR_FULL_DENSITY);
  const confidence = Math.round(35 + 45 * avgMargin + 20 * densityFactor);

  const indeterminate =
    totalSignals < MIN_TOTAL_SIGNALS || confidence < INDETERMINATE_CONFIDENCE_FLOOR;

  const profile = STYLE_PROFILES[type];
  const responsivenessLabel = responsiveness === "task" ? "ממוקד-משימה" : "ממוקד-אנשים";
  const assertivenessLabel = assertiveness === "high" ? "אסרטיביות גבוהה" : "אסרטיביות נמוכה";
  const explanation = indeterminate
    ? `נמצאו מעט מדי סימנים לשוניים בתמלול (${totalSignals} סה"כ) כדי לקבוע סגנון תקשורת בביטחון.`
    : `${profile.he} (${profile.colorName}) — זוהה על בסיס ${totalSignals} סימנים לשוניים בתמלול: נטייה ל${responsivenessLabel} (${formalInformalScore}/18) ו${assertivenessLabel} (${dominantPassiveScore}/18).`;

  const signals = [
    ...raw.formalInformalSigns.map((s) => ({
      quote: s.quote,
      interpretation: `נטייה ל${s.pole === "formal" ? "רשמיות/משימתיות" : "אי-רשמיות/אנושיות"} (זוג: ${FORMAL_INFORMAL_PAIRS[s.pairNumber - 1].pole1} / ${FORMAL_INFORMAL_PAIRS[s.pairNumber - 1].pole2})`,
    })),
    ...raw.dominantPassiveSigns.map((s) => ({
      quote: s.quote,
      interpretation: `נטייה ל${s.pole === "dominant" ? "דומיננטיות" : "פאסיביות"} (זוג: ${DOMINANT_PASSIVE_PAIRS[s.pairNumber - 1].pole1} / ${DOMINANT_PASSIVE_PAIRS[s.pairNumber - 1].pole2})`,
    })),
  ];

  return {
    type,
    secondaryType,
    confidence,
    indeterminate,
    axes: { assertiveness, responsiveness },
    discAxes: {
      formalInformal: { score: formalInformalScore, signalCount: formalInformalTotal },
      dominantPassive: { score: dominantPassiveScore, signalCount: dominantPassiveTotal },
    },
    signals,
    explanation,
    howToSellToThisType: profile.howToCommunicate,
    redFlags: profile.redFlags,
  };
}

/**
 * Orchestrator: runs the focused DISC scoring call, then the deterministic
 * mapping, and shapes the result into AnalysisResult["customerPersonality"].
 * This is the single source of truth for customer personality going forward —
 * the caller (lib/inngest/functions.ts) overwrites whatever GPT-4o's synthesis
 * step produced for this field with this result.
 */
export async function computeCustomerPersonality(
  transcript: string,
  step: DiscStep
): Promise<AnalysisResult["customerPersonality"]> {
  const raw = await scoreDiscAxes(transcript, step);
  const computed = computeDiscResult(raw);
  return {
    type: computed.type,
    secondaryType: computed.secondaryType,
    explanation: computed.explanation,
    confidence: computed.confidence,
    indeterminate: computed.indeterminate,
    axes: computed.axes,
    discAxes: computed.discAxes,
    signals: computed.signals,
    howToSellToThisType: computed.howToSellToThisType,
    redFlags: computed.redFlags,
  };
}
