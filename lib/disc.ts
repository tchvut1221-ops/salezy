import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { GetStepTools } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { parseModelJson } from "@/lib/analysis";
import { normalizeForMatch, isVerbatimQuote } from "@/lib/verbatim";
import {
  FORMAL_INFORMAL_PAIRS,
  DOMINANT_PASSIVE_PAIRS,
  STYLE_PROFILES,
  PERSONALITY_TYPE_META,
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
 * one of the consistency levers — a narrow, deterministic-as-possible sampling
 * config for the one field (DISC type) that was flip-flopping between runs.
 * Temperature 0 alone is NOT enough (Claude isn't bit-deterministic, and near a
 * quadrant boundary a single pass is a coin flip) — see ensembleDetectSigns()
 * below for the self-consistency layer that actually stabilizes the result.
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

/** Default number of detection passes to pool per DISC scoring (env-overridable). */
const DEFAULT_ENSEMBLE_PASSES = 5;

/**
 * How many sign-detection passes to run and pool per call, from
 * DISC_ENSEMBLE_PASSES (default 5, clamped to [1,9]). 1 reproduces the old
 * single-pass behavior; higher = more stable/costly. Garbage/unset → default.
 */
export function getDiscEnsemblePasses(): number {
  const n = Number(process.env.DISC_ENSEMBLE_PASSES);
  if (!Number.isFinite(n)) return DEFAULT_ENSEMBLE_PASSES;
  return Math.min(9, Math.max(1, Math.floor(n)));
}

/** Concatenates the verified signs from several detection passes into one set. */
export function poolSigns(samples: RawDiscSigns[]): RawDiscSigns {
  return {
    formalInformalSigns: samples.flatMap((s) => s.formalInformalSigns),
    dominantPassiveSigns: samples.flatMap((s) => s.dominantPassiveSigns),
  };
}

let discClient: Anthropic | null = null;
function getDiscClient(): Anthropic {
  if (!discClient) discClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return discClient;
}

/** One focused sign-detection pass via the raw Anthropic SDK → verified signs. */
async function detectSignsOnce(transcript: string): Promise<RawDiscSigns> {
  const body = buildDiscRequestBody(transcript);
  const res = await getDiscClient().messages.create({ model: DISC_MODEL_ID, ...body });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return parseDiscResponse(text, transcript);
}

/**
 * Self-consistency ensemble: run the focused detection pass `passes` times in
 * PARALLEL and pool the verified signs before the deterministic compute. A
 * single low-temperature pass is too noisy on a genuinely borderline call (the
 * same transcript flips Driver↔Expressive run to run); pooling K passes averages
 * out that sampling noise so the majority/margin/blend logic sees the TRUE
 * cross-pass balance instead of one coin flip. Mirrors the transcribe step's
 * "Promise.all of raw SDK calls" pattern (lib/inngest/functions.ts). Failed
 * passes are dropped (allSettled) so one transient API error doesn't sink the
 * whole DISC step; if every pass fails, degrade to no-signs → indeterminate.
 */
export async function ensembleDetectSigns(
  transcript: string,
  passes: number = getDiscEnsemblePasses()
): Promise<RawDiscSigns> {
  const settled = await Promise.allSettled(
    Array.from({ length: passes }, () => detectSignsOnce(transcript))
  );
  const ok = settled
    .filter((r): r is PromiseFulfilledResult<RawDiscSigns> => r.status === "fulfilled")
    .map((r) => r.value);
  return ok.length > 0 ? poolSigns(ok) : EMPTY_RAW_SIGNS;
}

/**
 * Anti-fabrication gate, mirroring normalizeScorecard()'s pattern in
 * lib/analysis.ts: a detected sign is only trusted if its quote can actually be
 * found (loosely normalized) in the transcript. Drops anything the model
 * asserts but didn't actually quote verbatim.
 */
function filterVerbatimSigns(raw: RawDiscSigns, transcript: string): RawDiscSigns {
  const normalizedTranscript = normalizeForMatch(transcript);
  const isVerbatim = (quote: string) => isVerbatimQuote(quote, normalizedTranscript);
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
export function computeDiscResult(raw: RawDiscSigns, passes = 1): DiscComputation {
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
  // When signs are pooled across `passes` detection runs, raw counts scale with
  // the pass count but evidence density *per pass* does not. Density + the
  // min-signals gate are calibrated for a single pass, so measure them against
  // the per-pass average; margins/scores above use the pooled counts directly
  // (ratios are invariant to pass count and only get more reliable when pooled).
  const effectiveSignals = totalSignals / Math.max(1, passes);
  const densityFactor = Math.min(1, effectiveSignals / SIGNAL_TARGET_FOR_FULL_DENSITY);
  const confidence = Math.round(35 + 45 * avgMargin + 20 * densityFactor);

  const indeterminate =
    effectiveSignals < MIN_TOTAL_SIGNALS || confidence < INDETERMINATE_CONFIDENCE_FLOOR;

  const profile = STYLE_PROFILES[type];
  const meta = PERSONALITY_TYPE_META[type];
  const responsivenessLabel = responsiveness === "task" ? "ממוקד-משימה" : "ממוקד-אנשים";
  const assertivenessLabel = assertiveness === "high" ? "אסרטיביות גבוהה" : "אסרטיביות נמוכה";
  const explanation = indeterminate
    ? `נמצאו מעט מדי סימנים לשוניים בתמלול (${totalSignals} סה"כ) כדי לקבוע סגנון תקשורת בביטחון.`
    : `${meta.he} (${meta.colorName}) — זוהה על בסיס ${totalSignals} סימנים לשוניים בתמלול: נטייה ל${responsivenessLabel} (${formalInformalScore}/18) ו${assertivenessLabel} (${dominantPassiveScore}/18).`;

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
 * Orchestrator: runs the DISC sign-detection ensemble inside one durable Inngest
 * step, then the deterministic mapping, and shapes the result into
 * AnalysisResult["customerPersonality"]. This is the single source of truth for
 * customer personality going forward — the caller (lib/inngest/functions.ts)
 * overwrites whatever GPT-4o's synthesis step produced for this field.
 *
 * The K parallel LLM calls run via the raw Anthropic SDK inside a single
 * step.run (mirroring the transcribe step's Promise.all-of-SDK-calls pattern),
 * NOT via K separate step.ai.infer steps — the pooled signs it returns are
 * plain JSON, safe to memoize, and the deterministic compute below re-derives
 * the same result on any replay.
 */
export async function computeCustomerPersonality(
  transcript: string,
  step: DiscStep
): Promise<AnalysisResult["customerPersonality"]> {
  const passes = getDiscEnsemblePasses();
  const raw = await step.run("score-disc", () => ensembleDetectSigns(transcript, passes));
  const computed = computeDiscResult(raw, passes);
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
