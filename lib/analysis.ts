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

const scorecardCategory = z.object({
  score: z.number().min(1).max(5).nullable(),
  rationale: z.string(),
  quote: z.string().nullable(),
  // Per-stage additions for the Stage Analysis timeline. Tolerant like every
  // other v2 field: an off-enum sentiment or bad failurePoint is dropped, not
  // fatal, and legacy/scorecard-era analyses (which have neither) still validate.
  sentiment: sentimentValue.optional().catch(undefined),
  failurePoint: z.string().nullable().optional().catch(undefined),
});

const coachingActionSchema = z.object({
  action: z.string(),
  why: z.string(),
  how: z.string(),
  priority: z.enum(["high", "medium", "low"]),
});

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
    /** Set by the dedicated DISC engine (lib/disc.ts), never by the LLM synthesis. */
    indeterminate: z.boolean().optional().catch(undefined),
    discAxes: z
      .object({
        formalInformal: z.object({ score: z.number(), signalCount: z.number() }),
        dominantPassive: z.object({ score: z.number(), signalCount: z.number() }),
      })
      .optional()
      .catch(undefined),
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
  salespersonScorecard: z
    .object({
      opening: scorecardCategory,
      discovery: scorecardCategory,
      pitch: scorecardCategory,
      objectionHandling: scorecardCategory,
      closing: scorecardCategory,
      talkRatio: z
        .object({
          repPercentage: z.number(),
          customerPercentage: z.number(),
          benchmarkRepPercentage: z.literal(43),
          verdict: z.enum(["optimal", "below_optimal", "above_optimal"]),
        })
        .nullable(),
      overallScorecardScore: z.number().nullable(),
      strengths: z.array(z.string()).min(1).max(3),
      improvementAreas: z.array(z.string()).min(1).max(3),
    })
    .optional()
    .catch(undefined),
  coachingActions: z
    .array(coachingActionSchema)
    .min(2)
    .max(3)
    .optional()
    .catch(undefined),
  weeklyFocus: z
    .object({
      primaryGoal: z.string(),
      successMetric: z.string(),
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
3. סוג אישיות הלקוח לפי DISC — **דלג על סעיף זה.** סיווג ה-DISC מחושב בנפרד על ידי מנוע ייעודי כמותי (לא על ידך) — אין צורך שתנתח או תסווג אישיות בתשובתך.
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
14. כרטיס ביצועים מפורט של איש המכירות (Scorecard) — ניתוח נפרד ומוסף על סעיף 8, אל תמזג אותם. דרג את איש המכירות בנפרד בכל אחת מ-5 הקטגוריות, בסולם 1-5:
   - opening (פתיחה): בניית מערכת יחסים, אג'נדה ברורה, שליטה מקצועית בפתיחת השיחה.
   - discovery (גילוי צרכים): עומק השאלות, האם נחשפו צרכים אמיתיים ולא רק פני שטח.
   - pitch (הצגת פתרון): התאמת ההצעה לצרכים שעלו בגילוי, מיקוד בערך ולא רק בפיצ'רים.
   - objection_handling (טיפול בהתנגדויות): התייחסות עניינית ולא הגנתית, שינוי תפיסה אמיתי אצל הלקוח.
   - closing (סגירה): בקשה ברורה לצעד הבא, יצירת מחויבות קונקרטית, לא משאיר את השיחה באוויר.

   ⚠️ כלל אנטי-פברוקציה: ציון לקטגוריה מותר רק אם יש רגע קונקרטי בתמלול התומך בו, עם ציטוט מילולי קצר. אם אין רגע רלוונטי (למשל השיחה נקטעה לפני שלב הסגירה, או לא עלתה אף התנגדות) — אל תמציא ציטוט ואל תיתן ציון; ציין זאת בנימוק בקצרה בלי ציון ובלי ציטוט מומצא.

   לכל אחד מ-5 השלבים, גם כשאין ציון: קבע סנטימנט (sentiment) — positive / neutral / negative — שמשקף את האווירה הרגשית של הלקוח באותו שלב ספציפי של השיחה (זה שונה מהסנטימנט בסעיף 13, שהוא לפי ציר זמן: תחילת/אמצע/סוף השיחה). כמו כן זהה נקודת כשל לשלב (failurePoint): משפט עברית קצר וקונקרטי שמצביע היכן השלב נחלש, פוספס או נכשל (למשל "עבר להצגת המחיר לפני שווידא צורך", או "השיחה הסתיימה בלי בקשת צעד הבא") — או null אם השלב היה חזק ולא זוהתה נקודת כשל.

   לכל קטגוריה שניתן לדרג: תן ציון 1-5, נימוק קצר, וציטוט מילולי תומך. בנוסף:
   - זהה 1-3 חוזקות ספציפיות עם ראיה מהשיחה (לא כלליות — למשל "שיקף ללקוח את הכאב שלו במילים שלו לפני שהציג פתרון", לא "תקשורת טובה").
   - זהה 1-3 תחומי שיפור ספציפיים עם ראיה (לא "לשפר סגירה" — אלא למשל "לא ביקש צעד הבא מוגדר בסיום השיחה, השיחה הסתיימה בלי תאריך פולו-אפ").
15. תוכנית אימון שבועית — בהתבסס על הקטגוריה עם הציון הנמוך ביותר בסעיף 14 (או תחום השיפור הבולט ביותר אם אין מספיק ציונים למדד סטטיסטי), הגדר יעד מרכזי אחד לשבוע הקרוב עם מדד הצלחה מדיד וקונקרטי. הצע גם 2-3 פעולות אימון: לכל אחת — פעולה ברורה (מה לעשות), נימוק מבוסס-תצפית (למה זה חשוב לפי מה שנצפה בשיחה הזו), הנחיה מעשית לשיחה הבאה (איך בפועל), ורמת עדיפות (high / medium / low). לפחות פעולה אחת חייבת להיות high priority. אסור ניסוח גנרי ("תשפר את השאלות שלך") — כל פעולה חייבת להיות ספציפית וניתנת ליישום מיידי (למשל: "בפתיחת השיחה הבאה, שאל את הלקוח 'מה גרם לך להתחיל לחפש פתרון עכשיו ולא לפני חצי שנה?' כדי לחשוף דחיפות אמיתית").

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
  const system = `החזר אך ורק JSON תקין (Return ONLY valid JSON) — בלי טקסט לפני או אחרי האובייקט, ובלי עיצוב markdown כמו גדרות קוד (\`\`\`json ... \`\`\`). כל תו מחוץ לאובייקט ה-JSON עצמו ישבור את הפרסור אצלנו.

קיבלת ניתוח מקצועי של שיחת מכירה בעברית. המר אותו ל-JSON תקין בלבד (ללא טקסט נוסף) במבנה הבא. כלול שדה רק אם המידע קיים בניתוח — אם אין מידע למימד מסוים, השמט את השדה לגמרי (אל תמציא ערכים ואל תכתוב null).

{
  "executiveSummary": "תקציר 2-3 משפטים",
  "overallScore": 0-100,
  "callObjective": "מטרת השיחה",
  "callObjectiveAchieved": "yes | partial | no",
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
  },
  "salespersonScorecard": {
    "opening": { "score": 1-5 or null, "rationale": "נימוק קצר", "quote": "ציטוט מהתמלול או null", "sentiment": "positive | neutral | negative", "failurePoint": "נקודת כשל קצרה בעברית או null" },
    "discovery": { "score": 1-5 or null, "rationale": "...", "quote": "... או null", "sentiment": "positive | neutral | negative", "failurePoint": "... או null" },
    "pitch": { "score": 1-5 or null, "rationale": "...", "quote": "... או null", "sentiment": "positive | neutral | negative", "failurePoint": "... או null" },
    "objectionHandling": { "score": 1-5 or null, "rationale": "...", "quote": "... או null", "sentiment": "positive | neutral | negative", "failurePoint": "... או null" },
    "closing": { "score": 1-5 or null, "rationale": "...", "quote": "... או null", "sentiment": "positive | neutral | negative", "failurePoint": "... או null" },
    "strengths": ["חוזקה ספציפית עם ראיה", "..."],
    "improvementAreas": ["תחום שיפור ספציפי עם ראיה", "..."]
  },
  "coachingActions": [
    { "action": "מה לעשות", "why": "למה (מבוסס תצפית)", "how": "הנחיה מעשית", "priority": "high | medium | low" }
  ],
  "weeklyFocus": {
    "primaryGoal": "יעד מרכזי לשבוע הקרוב",
    "successMetric": "איך נמדוד הצלחה"
  }
}

⚠️ חשוב:
- אל תכלול שדה customerPersonality בתשובתך בכלל — סיווג האישיות מחושב בנפרד על ידי מנוע ייעודי ולא ממך. אם תכלול אותו בכל זאת, הוא יוחלף לגמרי ויתעלמו ממנו.
- כל שאר ערכי ה-enum (callObjectiveAchieved, dealStage, objections[].score, keyMoments[].type, nextSteps[].priority, energyLevel, callPace, sentiment) חייבים להיות בדיוק באנגלית כפי שמופיע למעלה.
- כל שאר הטקסט בתוך ה-JSON חייב להיות בעברית.
- השדות whatWorked, whatDidnt, tips, explicit, implicit חובה תמיד.
- salespersonScorecard.*.score (בכל אחת מ-5 הקטגוריות) חייב להיות מספר שלם 1-5 **או null**. לעולם אל תיתן score בלי quote תומך — אם אין quote אמיתי, גם score וגם quote צריכים להיות null.
- salespersonScorecard.*.sentiment חייב להיות בדיוק אחד מ: "positive", "neutral", "negative" (באנגלית). salespersonScorecard.*.failurePoint הוא משפט עברית קצר או null — קבע null כשהשלב היה חזק ולא הייתה נקודת כשל.
- coachingActions.*.priority חייב להיות בדיוק "high", "medium" או "low" (באנגלית). לפחות פריט אחד חייב להיות "high".
- אל תכלול overallScorecardScore ואל תכלול talkRatio בתוך salespersonScorecard — הם מחושבים אוטומטית מחוץ ל-JSON שלך, אל תמציא אותם.
- שמור על נאמנות מוחלטת לניתוח שקיבלת — אל תוסיף מידע שלא נמצא בו.
- תזכורת אחרונה: החזר אך ורק את אובייקט ה-JSON. בלי גדרות markdown, בלי טקסט הסבר לפני או אחרי. Return ONLY the JSON object — no markdown code fences, no text before or after.`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    // Raised from 4096: the salespersonScorecard/coachingActions/weeklyFocus
    // additions (6 quote-anchored categories + up to 3 coaching actions on
    // top of everything already in this schema) can push a richly-populated
    // analysis past the old budget, truncating the JSON mid-object instead of
    // erroring — hit in production once the scorecard fields shipped.
    max_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: reasoning },
    ],
  });

  const choice = res.choices[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error("Empty synthesis response from the model");
  }
  if (choice.finish_reason === "length") {
    // Even at the raised budget, an unusually rich call can still exhaust it —
    // this pinpoints truncation specifically (vs. some other malformed-JSON
    // cause) in the logs so a future max_tokens bump is an easy diagnosis.
    console.error(
      "[synthesizeAnalysis] Completion hit max_tokens and was likely truncated (finish_reason=length). Last 500 chars:",
      content.slice(-500)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw model JSON, shape-checked below then Zod-validated
  const raw: any = parseModelJson(content);
  // customerPersonality is no longer authored by GPT-4o (the dedicated DISC engine
  // in lib/disc.ts owns it — see lib/inngest/functions.ts's score-disc step, which
  // overwrites this field entirely right after synthesizeAnalysis returns). This is
  // a throwaway placeholder satisfying resultSchema's required shape in the
  // meantime; its content is never read by anything downstream of the overwrite.
  // Still defensively normalized in case the model includes one anyway (it was told
  // not to, but occasionally does).
  const personality = raw?.customerPersonality;
  if (personality) {
    personality.type = normalizeDiscType(personality.type) ?? personality.type;
    const secondary = normalizeDiscType(personality.secondaryType);
    if (secondary) personality.secondaryType = secondary;
  } else {
    raw.customerPersonality = { type: "Analytical", explanation: "" };
  }
  if (raw?.salespersonScorecard) {
    raw.salespersonScorecard = normalizeScorecard(raw.salespersonScorecard, raw.callMetrics);
  }
  return resultSchema.parse(raw);
}

/**
 * Parses GPT-4o's synthesis response into a raw object, tolerating the
 * failure modes a `json_object`-mode completion can still hit in practice:
 * markdown code fences wrapped around the JSON despite being told not to,
 * stray text before/after the object, or the object being cut off mid-
 * generation by hitting max_tokens on a long, richly-populated analysis.
 * Tries increasingly aggressive recovery steps before giving up; logs the
 * start/end of the raw response (not the whole, potentially large payload)
 * so a real failure is debuggable from Inngest/Vercel logs.
 */
export function parseModelJson(content: string): unknown {
  const stripFences = (s: string) =>
    s
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

  const extractBraces = (s: string) => {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    return start !== -1 && end !== -1 && end > start ? s.slice(start, end + 1) : s;
  };

  const stripTrailingCommas = (s: string) => s.replace(/,(\s*[}\]])/g, "$1");

  const attempts: Array<() => string> = [
    () => content,
    () => stripFences(content),
    () => extractBraces(stripFences(content)),
    () => stripTrailingCommas(extractBraces(stripFences(content))),
  ];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt());
    } catch {
      // fall through to the next, more aggressive recovery step
    }
  }

  console.error(
    "[synthesizeAnalysis] Failed to parse model JSON after all recovery attempts.",
    "First 500 chars:",
    content.slice(0, 500),
    "Last 500 chars:",
    content.slice(-500)
  );
  throw new Error("תשובת המודל לא הייתה JSON תקין");
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

/**
 * Defensive post-processing for the scorecard, mirroring normalizeDiscType():
 * fix up the model's raw output in code before Zod validation, rather than
 * trusting prompt discipline alone for anything fabrication-sensitive or
 * arithmetic.
 *  1. Anti-fabrication: a category score is only valid alongside a non-empty
 *     quote. If the model emits a score with no real quote, null the score.
 *  2. talkRatio is derived entirely from callMetrics.talkRatioSalesperson
 *     (never taken from the model's own guess) so the UI never has to
 *     reconcile two disagreeing "talk ratio" numbers for one call.
 *  3. overallScorecardScore is recomputed as the average of the non-null
 *     category scores — never trusted from the model — eliminating
 *     arithmetic drift on the feature's headline number.
 */
function normalizeScorecard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw model JSON, shape-checked here then Zod-validated by resultSchema
  raw: any,
  callMetrics: { talkRatioSalesperson?: number } | undefined
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const categories = ["opening", "discovery", "pitch", "objectionHandling", "closing"] as const;

  for (const key of categories) {
    const cat = raw[key];
    if (!cat) continue;
    const hasRealQuote = typeof cat.quote === "string" && cat.quote.trim().length > 0;
    if (!hasRealQuote) cat.score = null;
  }

  const scores = categories
    .map((key) => raw[key]?.score)
    .filter((s): s is number => typeof s === "number");
  raw.overallScorecardScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;

  const repPct = callMetrics?.talkRatioSalesperson;
  const BENCHMARK = 43;
  const TOLERANCE = 5; // +/-5pp around the benchmark still counts as "optimal"
  if (typeof repPct === "number") {
    const verdict =
      repPct > BENCHMARK + TOLERANCE
        ? "above_optimal"
        : repPct < BENCHMARK - TOLERANCE
          ? "below_optimal"
          : "optimal";
    raw.talkRatio = {
      repPercentage: repPct,
      customerPercentage: Math.round((100 - repPct) * 10) / 10,
      benchmarkRepPercentage: BENCHMARK,
      verdict,
    };
  } else {
    raw.talkRatio = null;
  }

  return raw;
}
