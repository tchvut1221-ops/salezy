import { z } from "zod";
import { STYLE_PROFILES, PERSONALITY_TYPE_META } from "@/lib/disc-reference";
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
