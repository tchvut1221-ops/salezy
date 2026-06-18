import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AnalysisResult, PersonalityType } from "@/types";
import { SALES_SYSTEM_KNOWLEDGE } from "@/lib/sales-knowledge";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const resultSchema = z.object({
  customerPersonality: z.object({
    type: z.enum(["Analytical", "Driver", "Amiable", "Expressive"]),
    explanation: z.string(),
  }),
  salespersonPerformance: z.object({
    whatWorked: z.array(z.string()),
    whatDidnt: z.array(z.string()),
    tips: z.array(z.string()),
  }),
  customerNeeds: z.object({
    explicit: z.array(z.string()),
    implicit: z.array(z.string()),
  }),
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
export async function reasonAboutCall(transcript: string): Promise<string> {
  const system = `אתה מומחה עולמי לניתוח שיחות מכירה בישראל. אתה מקבל תמלול של שיחה (עם תוויות דוברים) ומנתח אותה לעומק.

נתח בעברית, בצורה מובנית:
1. סוג אישיות הלקוח לפי DISC — עם נימוק וציטוטים מהשיחה.
2. ביצועי איש המכירות — מה עבד, מה פוספס, וטיפים מעשיים לשיפור.
3. צרכי הלקוח — גלויים (שנאמרו במפורש) וסמויים (שניתן להסיק).

הסתמך על הידע המקצועי הבא:

${SALES_SYSTEM_KNOWLEDGE}`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system,
    messages: [
      {
        role: "user",
        content: `הנה תמלול השיחה לניתוח:\n\n${transcript}`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Empty reasoning response from Claude");
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
  const system = `קיבלת ניתוח מקצועי של שיחת מכירה בעברית. המר אותו ל-JSON תקין בלבד (ללא טקסט נוסף) במבנה הבא:

{
  "customerPersonality": {
    "type": "Analytical | Driver | Amiable | Expressive",
    "explanation": "הסבר קצר בעברית עם דוגמאות"
  },
  "salespersonPerformance": {
    "whatWorked": ["..."],
    "whatDidnt": ["..."],
    "tips": ["..."]
  },
  "customerNeeds": {
    "explicit": ["..."],
    "implicit": ["..."]
  }
}

⚠️ חשוב: השדה customerPersonality.type חייב להיות **בדיוק** אחד מהערכים באנגלית — Analytical, Driver, Amiable, או Expressive. אל תתרגם אותו לעברית ואל תשנה אותו.

כל שאר הטקסט בתוך ה-JSON חייב להיות בעברית. שמר על נאמנות לניתוח שקיבלת. החזר JSON בלבד.`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
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

  const raw = JSON.parse(content);
  // Defensive: the model occasionally translates/varies the DISC type even when
  // told not to. Map common variants back to the canonical enum before Zod.
  const t = raw?.customerPersonality?.type;
  if (typeof t === "string") {
    const mapped = DISC_TYPE_MAP[t.trim().toLowerCase()];
    if (mapped) raw.customerPersonality.type = mapped;
  }
  return resultSchema.parse(raw);
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
