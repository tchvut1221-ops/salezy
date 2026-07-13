/**
 * Pure self-test for lib/practice.ts's prompt builders and feedback schema —
 * no secrets needed (mirrors scripts/verbatim-selftest.ts; the impure
 * sendPracticeTurn/generateFeedback calls are verified live instead, same as
 * every other Anthropic/OpenAI call site in this repo).
 * Run: npx tsx scripts/practice-selftest.ts
 */
import {
  buildPersonaSystemPrompt,
  buildFeedbackPrompt,
  practiceFeedbackSchema,
} from "../lib/practice";

let failures = 0;
function check(name: string, pass: boolean) {
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (!pass) failures++;
}

const prompt = buildPersonaSystemPrompt("sales_call", "טיפול בהתנגדות מחיר", "Driver");
check("persona prompt includes the focus text", prompt.includes("טיפול בהתנגדות מחיר"));
check("persona prompt includes the DISC type's Hebrew label", prompt.includes("משימתי"));
check("persona prompt includes a howToCommunicate item", prompt.includes("קצר, ענייני"));

const feedbackPrompt = buildFeedbackPrompt(
  [
    { role: "customer", content: "המחיר גבוה לי" },
    { role: "user", content: "בוא נראה מה מדאיג אותך" },
  ],
  "טיפול בהתנגדות מחיר"
);
check("feedback prompt includes the focus text", feedbackPrompt.includes("טיפול בהתנגדות מחיר"));
check(
  "feedback prompt includes both speakers' lines",
  feedbackPrompt.includes("המחיר גבוה לי") && feedbackPrompt.includes("בוא נראה מה מדאיג אותך")
);

check(
  "feedback schema accepts a valid object",
  practiceFeedbackSchema.safeParse({ whatWorked: "a", whatToImprove: "b" }).success
);
check(
  "feedback schema rejects a missing field",
  !practiceFeedbackSchema.safeParse({ whatWorked: "a" }).success
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
