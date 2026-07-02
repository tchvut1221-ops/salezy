import OpenAI from "openai";
import { z } from "zod";
import type { AiAdapter, GetStepTools } from "inngest";
import { inngest } from "@/lib/inngest/client";
import type { AnalysisResult, PersonalityType } from "@/types";
import { SALES_SYSTEM_KNOWLEDGE } from "@/lib/sales-knowledge";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type AnalyzeCallStep = GetStepTools<typeof inngest>;

// v1 core fields stay strict (they always exist). Every v2 field is optional AND
// `.catch(undefined)` — if the model emits a malformed value (e.g. an off-enum
// string) we drop just that field instead of failing the whole analysis. Worst
// case the result degrades to v1-level richness; it never hard-fails.
const sentimentValue = z.enum(["positive", "neutral", "negative"]);

const resultSchema = z.object({
  customerPersonality: z.object({
    type: z.enum(["Analytical", "Driver", "Amiable", "Expressive"]),
    explanation: z.string(),
    confidence: z.number().optional().catch(undefined),
    /** נטייה משנית (תמהיל) — רוב האנשים אינם טיפוס טהור */
    secondaryType: z
      .enum(["Analytical", "Driver", "Amiable", "Expressive"])
      .optional()
      .catch(undefined),
    /** קריאת שני הצירים שמהם נגזר הטיפוס */
    axes: z
      .object({
        assertiveness: z.enum(["high", "low"]),
        responsiveness: z.enum(["task", "people"]),
      })
      .optional()
      .catch(undefined),
    /** ציטוטי ראיה מהתמלול שהובילו לסיווג */
    signals: z
      .array(z.object({ quote: z.string(), interpretation: z.string() }))
      .optional()
      .catch(undefined),
    howToSellToThisType: z.array(z.string()).optional().catch(undefined),
    redFlags: z.array(z.string()).optional().catch(undefined),
  }),
  salespersonPerformance: z.object({
    whatWorked: z.array(z.string()),
    whatDidnt: z.array(z.string()),
    tips: z.array(z.string()),
    overallScore: z.number().optional().catch(undefined),
    scores: z
      .object({
        needsDiscovery: z.number(),
        objectionHandling: z.number(),
        listeningRatio: z.number(),
        closing: z.number(),
      })
      .optional()
      .catch(undefined),
  }),
  customerNeeds: z.object({
    explicit: z.array(z.string()),
    implicit: z.array(z.string()),
    painPoints: z.array(z.string()).optional().catch(undefined),
    priorities: z.array(z.string()).optional().catch(undefined),
  }),

  executiveSummary: z.string().optional().catch(undefined),
  overallScore: z.number().optional().catch(undefined),
  callObjective: z.string().optional().catch(undefined),
  callObjectiveAchieved: z
    .enum(["yes", "partial", "no"])
    .optional()
    .catch(undefined),
  dealStage: z
    .enum(["discovery", "demo", "objection", "negotiation", "close", "unknown"])
    .optional()
    .catch(undefined),
  buyingSignals: z
    .object({ positive: z.array(z.string()), negative: z.array(z.string()) })
    .optional()
    .catch(undefined),
  competitorsMentioned: z.array(z.string()).optional().catch(undefined),
  objections: z
    .array(
      z.object({
        objection: z.string(),
        howHandled: z.string(),
        score: z.enum(["excellent", "good", "poor", "missed"]),
      })
    )
    .optional()
    .catch(undefined),
  keyMoments: z
    .array(
      z.object({
        quote: z.string(),
        type: z.enum([
          "buying_signal",
          "objection",
          "pain_point",
          "breakthrough",
        ]),
        significance: z.string(),
      })
    )
    .optional()
    .catch(undefined),
  nextSteps: z
    .array(
      z.object({
        action: z.string(),
        priority: z.enum(["urgent", "soon", "when-possible"]),
        reasoning: z.string(),
      })
    )
    .optional()
    .catch(undefined),
  callMetrics: z
    .object({
      estimatedDurationMinutes: z.number().optional().catch(undefined),
      talkRatioSalesperson: z.number().optional().catch(undefined),
      energyLevel: z.enum(["low", "medium", "high"]).optional().catch(undefined),
      callPace: z
        .enum(["rushed", "optimal", "slow"])
        .optional()
        .catch(undefined),
      sentiment: z
        .object({
          start: sentimentValue,
          middle: sentimentValue,
          end: sentimentValue,
        })
        .optional()
        .catch(undefined),
    })
    .optional()
    .catch(undefined),
});

/**
 * Step 1 of the hybrid pipeline — deep reasoning with Claude Sonnet 4.6.
 *
 * Claude excels at nuanced Hebrew interpretation (DISC personality, objection
 * subtlety), so it does the open-ended analysis here. Per the research finding,
 * separating free-form reasoning from JSON formatting beats forcing one model to
 * do both. The sales knowledge lives in the SYSTEM prompt; the transcript goes in
 * the USER turn — it must never be able to override the system instructions
 * (prompt-injection boundary, LLM01).
 *
 * Runs inside an Inngest step only.
 */
// Sane ceiling on transcript size — guards against a pathological input (wrong
// file, corrupted/looping transcription) burning Claude+GPT spend on a call
// far outside any real sales-call duration. ~150k chars is generous headroom
// over even a multi-hour call.
const MAX_TRANSCRIPT_CHARS = 150_000;

export async function reasonAboutCall(
  transcript: string,
  step: AnalyzeCallStep
): Promise<string> {
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error("התמלול ארוך מהצפוי לשיחת מכירה — ייתכן שהקובץ שגוי");
  }

  const system = `אתה מומחה עולמי לניתוח שיחות מכירה בישראל. אתה מקבל תמלול של שיחה (עם תוויות דוברים) ומנתח אותה לעומק, ומסתמך אך ורק על מה שנאמר בתמלול — בלי להמציא.

⚠️ אם התמלול קצר מדי, לא קוהרנטי, או לא מכיל תוכן מספק לניתוח אמין של שיחת מכירה אמיתית (למשל רעש רקע, מוזיקה, מלמול חד-צדדי, או טקסט חסר משמעות) — אל תמציא ניתוח. במקרה כזה ציין זאת במפורש ובבירור בתקציר המנהלים, תן ציוני confidence וציון כולל נמוכים מאוד (או השמט אותם לגמרי), ואל תמציא ציטוטים, שם חברה, שלב עסקה, או כל פרט שאינו מעוגן ישירות ומילולית בתמלול.

נתח בעברית, בצורה מובנית ומנומקת, את כל המימדים הבאים. לכל קביעה הצמד ציטוט קצר או הסבר מהשיחה:

1. תקציר מנהלים — 2-3 משפטים: מה קרה בשיחה ומה השורה התחתונה.
2. מטרת השיחה והאם הושגה (כן / חלקית / לא).
3. סוג אישיות הלקוח לפי DISC — נתח לעומק לפי מדריך הצירים, ההבחנה בין טיפוסים סמוכים, ומדריך כיול הביטחון:
   - הטיפוס הראשי (Driver / Expressive / Amiable / Analytical) + טיפוס משני/תמהיל אם יש נטייה משנית בולטת.
   - קריאת שני הצירים: אסרטיביות (גבוהה/נמוכה) ומיקוד (משימה/אנשים).
   - רמת ביטחון (0-100) לפי כמות וההתכנסות של הסימנים — אל תיתן ביטחון גבוה בלי בסיס.
   - הסימנים הלשוניים הספציפיים שהובילו לסיווג, כל אחד עם ציטוט קצר מהתמלול והסבר מה הוא מסגיר.
   - איך הכי נכון למכור לאישיות הזו, ומה שורף את העסקה מולה.
4. שלב העסקה לפי המדריך (discovery / demo / objection / negotiation / close / unknown).
5. אותות רכישה — חיוביים ושליליים — עם ציטוטים.
6. מתחרים שהוזכרו (אם הוזכרו).
7. התנגדויות — לכל אחת: מה הלקוח אמר, איך איש המכירות טיפל, ודירוג הטיפול (excellent / good / poor / missed) לפי ה-rubric.
8. ביצועי איש המכירות — ציון כולל (0-100) ותת-ציונים (חשיפת צרכים, טיפול בהתנגדויות, יחס הקשבה, סגירה) לפי ה-rubric, מה עבד, מה פוספס, וטיפים מעשיים.
9. צרכי הלקוח — גלויים, סמויים, נקודות כאב, וסדרי עדיפויות.
10. רגעי מפתח — לפחות 3 ציטוטים משמעותיים, כל אחד עם סוג (buying_signal / objection / pain_point / breakthrough) ולמה הוא חשוב.
11. צעדים הבאים — לפחות 2 פעולות קונקרטיות עם עדיפות (urgent / soon / when-possible) ונימוק.
12. ציון כולל לשיחה (0-100) לפי ה-rubric.
13. מדדי שיחה (רק אם ניתן להעריך מהתמלול): משך משוער בדקות, יחס הדיבור של איש המכירות באחוזים (אמוד לפי כמות הדיבור של כל דובר), רמת אנרגיה, קצב, וסנטימנט בתחילת/אמצע/סוף השיחה. אם אי אפשר להעריך מדד מסוים — דלג עליו ואל תנחש.

הסתמך על הידע המקצועי הבא:

${SALES_SYSTEM_KNOWLEDGE}`;

  // Thinking and the final text share one max_tokens budget. 8192 with
  // unbounded adaptive thinking let thinking consume the whole budget and
  // leave zero text on real (~30+ min) calls ("Empty reasoning response from
  // Claude"). Raising max_tokens to 16000 fixed that, but then unbounded
  // thinking on long transcripts pushed the call's wall-clock time past
  // Vercel's 300s function limit (FUNCTION_INVOCATION_TIMEOUT) — an earlier
  // fix capped budget_tokens to bound that, trading away analysis depth.
  // Dispatching via Inngest's AI Gateway instead removes the constraint at
  // the root: the outbound call to Anthropic is made by Inngest's own
  // infrastructure, not this Vercel function, so it can't trip maxDuration
  // no matter how long thinking takes — restoring unbounded adaptive
  // thinking is safe again.
  const model = step.ai.models.anthropic({
    model: "claude-sonnet-4-6",
    defaultParameters: { max_tokens: 16000 },
  });

  // `thinking` and `output_config` aren't part of @inngest/ai's declared
  // Anthropic input type yet, but the AI Gateway forwards `body` to the wire
  // unmodified, so they still reach Anthropic's API — this cast only works
  // around the missing types. `effort` (not `budget_tokens`, deprecated on
  // this model) is Anthropic's current lever for thinking depth vs. speed;
  // "medium" is their documented recommended default for Sonnet 4.6 — a
  // milder choice than "low" while still trading some depth for speed.
  const body = {
    system,
    messages: [
      {
        role: "user",
        content: `הנה תמלול השיחה לניתוח:\n\n${transcript}`,
      },
    ],
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
  } as AiAdapter.Input<typeof model> & {
    thinking: { type: "adaptive" };
    output_config: { effort: "medium" };
  };

  const res = await step.ai.infer("reason", { model, body });

  const text = res.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error(
      `Empty reasoning response from Claude (stop_reason: ${res.stop_reason})`
    );
  }
  return text;
}

/**
 * Step 2 of the hybrid pipeline — convert Claude's free-form analysis into the
 * strict AnalysisResult schema with GPT-4o (best-in-class JSON reliability).
 * Validates against Zod before returning. Runs inside an Inngest step only.
 */
export async function synthesizeAnalysis(
  reasoning: string
): Promise<AnalysisResult> {
  const system = `קיבלת ניתוח מקצועי של שיחת מכירה בעברית. המר אותו ל-JSON תקין בלבד (ללא טקסט נוסף) במבנה הבא. כלול שדה רק אם המידע קיים בניתוח — אם אין מידע למימד מסוים, השמט את השדה לגמרי (אל תמציא ערכים ואל תכתוב null).

{
  "executiveSummary": "תקציר 2-3 משפטים",
  "overallScore": 0-100,
  "callObjective": "מטרת השיחה",
  "callObjectiveAchieved": "yes | partial | no",
  "customerPersonality": {
    "type": "Analytical | Driver | Amiable | Expressive",
    "secondaryType": "Analytical | Driver | Amiable | Expressive",
    "explanation": "הסבר קצר בעברית עם דוגמאות",
    "confidence": 0-100,
    "axes": { "assertiveness": "high | low", "responsiveness": "task | people" },
    "signals": [
      { "quote": "ציטוט קצר מהשיחה", "interpretation": "מה הציטוט מסגיר על הטיפוס (עברית)" }
    ],
    "howToSellToThisType": ["..."],
    "redFlags": ["..."]
  },
  "dealStage": "discovery | demo | objection | negotiation | close | unknown",
  "buyingSignals": { "positive": ["..."], "negative": ["..."] },
  "competitorsMentioned": ["..."],
  "objections": [
    { "objection": "מה הלקוח אמר", "howHandled": "איך טופל", "score": "excellent | good | poor | missed" }
  ],
  "salespersonPerformance": {
    "whatWorked": ["..."],
    "whatDidnt": ["..."],
    "tips": ["..."],
    "overallScore": 0-100,
    "scores": { "needsDiscovery": 0-100, "objectionHandling": 0-100, "listeningRatio": 0-100, "closing": 0-100 }
  },
  "customerNeeds": {
    "explicit": ["..."],
    "implicit": ["..."],
    "painPoints": ["..."],
    "priorities": ["..."]
  },
  "keyMoments": [
    { "quote": "ציטוט מהשיחה", "type": "buying_signal | objection | pain_point | breakthrough", "significance": "למה זה חשוב" }
  ],
  "nextSteps": [
    { "action": "מה לעשות", "priority": "urgent | soon | when-possible", "reasoning": "למה" }
  ],
  "callMetrics": {
    "estimatedDurationMinutes": 0,
    "talkRatioSalesperson": 0-100,
    "energyLevel": "low | medium | high",
    "callPace": "rushed | optimal | slow",
    "sentiment": { "start": "positive | neutral | negative", "middle": "positive | neutral | negative", "end": "positive | neutral | negative" }
  }
}

⚠️ חשוב:
- customerPersonality.type ו-customerPersonality.secondaryType חייבים להיות **בדיוק** אחד מ: Analytical, Driver, Amiable, Expressive (באנגלית). אל תתרגם ואל תשנה. השמט את secondaryType לגמרי אם אין נטייה משנית בולטת.
- customerPersonality.axes.assertiveness חייב להיות "high" או "low"; customerPersonality.axes.responsiveness חייב להיות "task" או "people".
- כל שאר ערכי ה-enum (callObjectiveAchieved, dealStage, objections[].score, keyMoments[].type, nextSteps[].priority, energyLevel, callPace, sentiment) חייבים להיות בדיוק באנגלית כפי שמופיע למעלה.
- כל שאר הטקסט בתוך ה-JSON חייב להיות בעברית.
- השדות whatWorked, whatDidnt, tips, explicit, implicit ו-customerPersonality חובה תמיד.
- שמור על נאמנות מוחלטת לניתוח שקיבלת — אל תוסיף מידע שלא נמצא בו. החזר JSON בלבד.`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: reasoning },
    ],
  });

  const content = res.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty synthesis response from the model");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw model JSON, shape-checked below then Zod-validated
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("תשובת המודל לא הייתה JSON תקין");
  }
  // Defensive: the model occasionally translates/varies the DISC type even when
  // told not to. Map common variants back to the canonical enum before Zod, for
  // both the primary type and the (optional) secondary/blend type.
  const personality = raw?.customerPersonality;
  if (personality) {
    personality.type = normalizeDiscType(personality.type) ?? personality.type;
    const secondary = normalizeDiscType(personality.secondaryType);
    if (secondary) personality.secondaryType = secondary;
  }
  return resultSchema.parse(raw);
}

/** Normalize a single DISC value (Hebrew/variant/typo) to the canonical enum, or undefined. */
function normalizeDiscType(value: unknown): PersonalityType | undefined {
  if (typeof value !== "string") return undefined;
  return DISC_TYPE_MAP[value.trim().toLowerCase()];
}

const DISC_TYPE_MAP: Record<string, PersonalityType> = {
  analytical: "Analytical",
  analytic: "Analytical",
  אנליטי: "Analytical",
  מנתח: "Analytical",
  driver: "Driver",
  דרייבר: "Driver",
  דחפן: "Driver",
  מוביל: "Driver",
  amiable: "Amiable",
  אמיאבל: "Amiable",
  ידידותי: "Amiable",
  נוח: "Amiable",
  expressive: "Expressive",
  אקספרסיבי: "Expressive",
  אקספרסיב: "Expressive",
  ביטויי: "Expressive",
};
