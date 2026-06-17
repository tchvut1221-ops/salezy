import OpenAI from "openai";
import { z } from "zod";
import type { AnalysisResult } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

const SYSTEM_PROMPT = `אתה מומחה לניתוח שיחות מכירה. קיבלת תמלול של שיחת מכירה בעברית בין איש מכירות ללקוח.
נתח את השיחה והחזר JSON תקין בלבד (ללא טקסט נוסף) במבנה הבא:

{
  "customerPersonality": {
    "type": "Analytical | Driver | Amiable | Expressive",
    "explanation": "הסבר קצר בעברית למה זיהית את סוג האישיות הזה, עם דוגמאות מהשיחה"
  },
  "salespersonPerformance": {
    "whatWorked": ["דברים שאיש המכירות עשה נכון, בעברית"],
    "whatDidnt": ["דברים שאיש המכירות פספס או עשה לא טוב, בעברית"],
    "tips": ["טיפים מעשיים וברורים לשיפור, בעברית"]
  },
  "customerNeeds": {
    "explicit": ["צרכים שהלקוח אמר במפורש, בעברית"],
    "implicit": ["צרכים סמויים שניתן להסיק, בעברית"]
  }
}

כל הטקסט בתוך ה-JSON חייב להיות בעברית. החזר JSON בלבד.`;

/**
 * Analyze a Hebrew sales-call transcript with GPT-4o into the 3 focus areas.
 * Validates the model output against a schema before returning.
 * Runs inside an Inngest step only.
 */
export async function analyzeTranscript(
  transcript: string
): Promise<AnalysisResult> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
  });

  const content = res.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty analysis response from the model");
  }

  const parsed = resultSchema.parse(JSON.parse(content));
  return parsed;
}
