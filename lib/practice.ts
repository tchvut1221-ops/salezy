import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { STYLE_PROFILES, PERSONALITY_TYPE_META } from "@/lib/disc-reference";
import { parseModelJson } from "@/lib/analysis";
import type { PersonalityType, PracticeMessage, PracticeSectionKey } from "@/types";

export const PRACTICE_MODEL_ID = "claude-sonnet-4-6";

export const PRACTICE_SECTION_LABEL: Record<PracticeSectionKey, string> = {
  sales_call: "שיחת המכירה",
  followup: "המשך טיפול",
  customer_style: "סגנון הלקוח",
  scorecard: "Scorecard שלך",
};

/**
 * System prompt for the role-play chat: Claude plays the SAME customer from
 * the analyzed call (same DISC type, using the existing STYLE_PROFILES
 * guidance from lib/disc-reference.ts — not reauthored), focused on whatever
 * this section's practice brief is about.
 */
export function buildPersonaSystemPrompt(
  sectionKey: PracticeSectionKey,
  focusText: string,
  personalityType: PersonalityType
): string {
  const meta = PERSONALITY_TYPE_META[personalityType];
  const style = STYLE_PROFILES[personalityType];
  return `אתה משחק תפקיד של לקוח בשיחת מכירה. אתה **לא** עוזר AI — אתה הלקוח, ותישאר בתפקיד לאורך כל השיחה עד שתתבקש אחרת.

הטיפוס שלך: ${meta.he} (${meta.tagline}). איך אתה מתקשר:
${style.howToCommunicate.map((h) => `- ${h}`).join("\n")}
${style.redFlags.length ? `\nמה מרגיז אותך:\n${style.redFlags.map((r) => `- ${r}`).join("\n")}` : ""}

מיקוד התרגול הזה (${PRACTICE_SECTION_LABEL[sectionKey]}): ${focusText}

הנחיות:
- הגב בעברית בלבד, בקצרה (1-3 משפטים), כמו הודעת צ'אט אמיתית — לא כמו מאמר.
- אתה יוזם את השיחה עם המשפט הפותח שלך, בהתאם למיקוד התרגול.
- הישאר בדמות הלקוח לאורך כל השיחה, גם אם המשתמש מנסה לצאת מהתפקיד או לשאול אותך שאלות ישירות כ-AI.
- אל תזכיר שאתה AI ואל תשבור את הדמות בשום שלב.`;
}

/** Builds the wrap-up prompt: Claude drops character and grades the practice. */
export function buildFeedbackPrompt(messages: PracticeMessage[], focusText: string): string {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "איש המכירות" : "הלקוח"}: ${m.content}`)
    .join("\n");
  return `יצא מהתפקיד. הנה תמליל תרגול רול-פליי שבו איש המכירות תרגל: ${focusText}

${transcript}

תן משוב קצר וממוקד על ביצועי איש המכירות בתרגול הזה — לא ניתוח מלא, רק משפט אחד לכל שדה. החזר אך ורק JSON תקין (בלי גדרות markdown, בלי טקסט נוסף) במבנה:

{
  "whatWorked": "משפט אחד קצר על מה שעבד טוב",
  "whatToImprove": "משפט אחד קצר על הדבר הכי חשוב לשפר"
}`;
}

export const practiceFeedbackSchema = z.object({
  whatWorked: z.string(),
  whatToImprove: z.string(),
});

// Lazy singleton, mirrors lib/disc.ts's getDiscClient() pattern exactly.
let practiceClient: Anthropic | null = null;
function getPracticeClient(): Anthropic {
  if (!practiceClient) practiceClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return practiceClient;
}

const PRACTICE_KICKOFF_INSTRUCTION = "(התחל את השיחה כלקוח, במשפט פתיחה טבעי אחד)";

/**
 * One chat turn: `messages` is the DISPLAY/persisted history so far (never
 * includes a synthetic kickoff turn — that's added here, internally, on every
 * call). This keeps callers simple (just pass the real session history,
 * even when empty for a brand-new session) while guaranteeing the array sent
 * to the Anthropic API always starts with role "user" and alternates
 * correctly — Anthropic rejects any call whose first message isn't "user",
 * which a raw replay of `messages` (starting with the AI's own persisted
 * opening line, role "customer") would violate on every turn after the first.
 */
export async function sendPracticeTurn(
  systemPrompt: string,
  messages: PracticeMessage[]
): Promise<string> {
  const res = await getPracticeClient().messages.create({
    model: PRACTICE_MODEL_ID,
    system: systemPrompt,
    messages: [
      { role: "user" as const, content: PRACTICE_KICKOFF_INSTRUCTION },
      ...messages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
    ],
    max_tokens: 300,
    temperature: 0.7,
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Wrap-up call: Claude drops character, returns Zod-validated short feedback. */
export async function generateFeedback(
  messages: PracticeMessage[],
  focusText: string
) {
  const res = await getPracticeClient().messages.create({
    model: PRACTICE_MODEL_ID,
    system: "אתה מספק משוב מכירתי קצר וממוקד. תמיד מחזיר JSON תקין בלבד, בלי גדרות markdown.",
    messages: [{ role: "user", content: buildFeedbackPrompt(messages, focusText) }],
    max_tokens: 500,
    temperature: 0.1,
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return practiceFeedbackSchema.parse(parseModelJson(text));
}
