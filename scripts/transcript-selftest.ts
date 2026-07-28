/**
 * Pure self-test for lib/transcript.ts — no secrets needed (mirrors
 * scripts/verbatim-selftest.ts; both modules are dependency-free by design).
 * Run: npx tsx scripts/transcript-selftest.ts
 *
 * The critical invariant this file exists to defend is the FIRST group below:
 * buildNormalizedIndex().normalized must stay byte-for-byte identical to
 * lib/verbatim.ts's normalizeForMatch(). The server-side pipeline uses
 * normalizeForMatch to decide which quotes are real; the transcript heatmap
 * uses buildNormalizedIndex to decide where they are. If the two ever drift,
 * quotes that passed the pipeline's verbatim filter would silently stop
 * being highlightable, with nothing else to catch it.
 */
import { normalizeForMatch } from "../lib/verbatim";
import {
  buildNormalizedIndex,
  findAllRanges,
  findQuoteRange,
  parseTranscriptTurns,
  rangesForTurn,
  resolveQuoteRanges,
  segmentText,
  transcriptSpeakers,
} from "../lib/transcript";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (!pass) {
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  actual:   ${JSON.stringify(actual)}`);
    failures++;
  }
}

// ── 1. Parity with lib/verbatim.ts's normalizeForMatch ──

const PARITY_CASES = [
  "",
  "   ",
  "שלום",
  "  שלום עולם  ",
  "שלום,   מה שלומך?",
  "א .  ב",
  " .א",
  "א.ב",
  "דובר 1: שלום, מדבר דני\nדובר 2: היי דני — מה שלומך?",
  'הוא אמר "אני לא בטוח" ואז שתק...',
  "שָׁלוֹם עֲלֵיכֶם",
  "מחיר: 1,500 ₪ (כולל מע\"מ)",
  "זה עולה 5,000-7,000 שקל – תלוי בכמות",
  "hello world — שלום",
  "רגע\tאחד\n\nובכן",
  "ד׳ ו״ו",
  "emoji 😀 באמצע",
  "  רווח קשיח ",
];

for (const [i, input] of PARITY_CASES.entries()) {
  const built = buildNormalizedIndex(input);
  check(
    `normalized output matches normalizeForMatch (case ${i})`,
    built.normalized,
    normalizeForMatch(input)
  );
  check(`map length tracks normalized length (case ${i})`, built.map.length, built.normalized.length);
  // Every recorded origin must be a real, monotonically non-decreasing offset.
  const monotonic = built.map.every(
    (v, k) => Number.isInteger(v) && v >= 0 && v < input.length && (k === 0 || v >= built.map[k - 1])
  );
  check(`map offsets are in-range and monotonic (case ${i})`, monotonic, true);
}

// ── 2. findQuoteRange: normalized-space match -> original-space range ──

const TRANSCRIPT = [
  "דובר 1: שלום, מדבר דני מסלייזי. איך אפשר לעזור?",
  "דובר 2: היי דני — אנחנו בודקים פתרון, אבל המחיר גבוה לנו מדי.",
  "דובר 1: אני מבין. בוא נראה מה מתאים לתקציב שלך.",
  "דובר 2: אם תוכל להוריד ב-10%, אני חותם היום.",
].join("\n");

const index = buildNormalizedIndex(TRANSCRIPT);

function sliceOf(quote: string): string | null {
  const range = findQuoteRange(quote, index, TRANSCRIPT);
  return range ? TRANSCRIPT.slice(range.start, range.end) : null;
}

check("exact substring resolves to itself", sliceOf("המחיר גבוה לנו מדי"), "המחיר גבוה לנו מדי");
check(
  "quote with punctuation the source lacks still resolves (the whole point)",
  sliceOf("שלום, מדבר דני מסלייזי!"),
  "שלום, מדבר דני מסלייזי"
);
check(
  "quote missing the source's punctuation still resolves",
  sliceOf("היי דני אנחנו בודקים פתרון"),
  "היי דני — אנחנו בודקים פתרון"
);
check(
  "quote with collapsed whitespace resolves across the original's spacing",
  sliceOf("אני   חותם    היום"),
  "אני חותם היום"
);
check("quote not present returns null", findQuoteRange("לא נאמר כאן מעולם", index, TRANSCRIPT), null);
check("single-character quote is rejected by the length floor", findQuoteRange("ש", index, TRANSCRIPT), null);
check("empty quote returns null", findQuoteRange("", index, TRANSCRIPT), null);
check("whitespace-only quote returns null", findQuoteRange("   ", index, TRANSCRIPT), null);

// Niqqud: the quote carries none, the source does. The range must still cover
// the vowelled original INCLUDING its trailing mark.
const VOWELLED = "דובר 1: אָמַרְתִּי שָׁלוֹם";
const vowelledIndex = buildNormalizedIndex(VOWELLED);
const vowelledRange = findQuoteRange("אמרתי שלום", vowelledIndex, VOWELLED);
check(
  "unvowelled quote resolves to the vowelled original span",
  vowelledRange ? VOWELLED.slice(vowelledRange.start, vowelledRange.end) : null,
  "אָמַרְתִּי שָׁלוֹם"
);
check(
  "range ends past the final combining mark, not on it",
  vowelledRange ? vowelledRange.end : null,
  VOWELLED.length
);

// A quote sitting at the very end of the string, and one at the very start.
check("quote at end of transcript resolves", sliceOf("אני חותם היום"), "אני חותם היום");
check("quote at start of transcript resolves", sliceOf("דובר 1"), "דובר 1");

// Astral characters must not corrupt offsets for anything after them.
const ASTRAL = "דובר 1: מעולה 😀 נתקדם";
const astralIndex = buildNormalizedIndex(ASTRAL);
const astralRange = findQuoteRange("נתקדם", astralIndex, ASTRAL);
check(
  "offsets survive an astral character earlier in the string",
  astralRange ? ASTRAL.slice(astralRange.start, astralRange.end) : null,
  "נתקדם"
);

// ── 3. findAllRanges (search) ──

const allDani = findAllRanges("דני", index, TRANSCRIPT);
check("search finds every occurrence", allDani.length, 2);
check(
  "each search hit slices back to the needle",
  allDani.map((r) => TRANSCRIPT.slice(r.start, r.end)),
  ["דני", "דני"]
);
check("search miss returns an empty list", findAllRanges("קוואזר", index, TRANSCRIPT), []);
check("empty search returns an empty list", findAllRanges("", index, TRANSCRIPT), []);

// ── 4. parseTranscriptTurns ──

const turns = parseTranscriptTurns(TRANSCRIPT);
check("one turn per line", turns.length, 4);
check("speaker prefix is stripped from the text", turns[0].text, "שלום, מדבר דני מסלייזי. איך אפשר לעזור?");
check("speaker label is captured", turns.map((t) => t.speaker), [
  "דובר 1",
  "דובר 2",
  "דובר 1",
  "דובר 2",
]);
check(
  "turn offsets slice back to the turn text exactly",
  turns.every((t) => TRANSCRIPT.slice(t.start, t.end) === t.text),
  true
);
check("distinct speakers, in first-appearance order", transcriptSpeakers(turns), ["דובר 1", "דובר 2"]);
check("empty transcript yields no turns", parseTranscriptTurns(""), []);

const UNLABELED = "שורה ראשונה בלי דובר\n\nשורה שנייה";
const unlabeledTurns = parseTranscriptTurns(UNLABELED);
check("non-diarized fallback still yields turns", unlabeledTurns.length, 2);
check("non-diarized turns have no speaker", unlabeledTurns.map((t) => t.speaker), [null, null]);
check(
  "non-diarized turn offsets are still exact",
  unlabeledTurns.every((t) => UNLABELED.slice(t.start, t.end) === t.text),
  true
);

const WRAPPED = "דובר 1: משפט ראשון\nהמשך של אותו דובר\nדובר 2: תשובה";
const wrappedTurns = parseTranscriptTurns(WRAPPED);
check("a prefix-less line inherits the previous speaker", wrappedTurns[1].speaker, "דובר 1");
check("...and is flagged as a continuation", wrappedTurns.map((t) => t.isContinuation), [
  false,
  true,
  false,
]);

// ── 5. resolveQuoteRanges + rangesForTurn + segmentText ──

const resolved = resolveQuoteRanges(
  [
    { quote: "המחיר גבוה לנו מדי", value: "objection" },
    // Overlaps the first: must fold into it rather than produce a second span.
    { quote: "המחיר גבוה", value: "scorecard" },
    { quote: "אני חותם היום", value: "buying_signal" },
    { quote: "ציטוט שהומצא", value: "ghost" },
  ],
  index,
  TRANSCRIPT
);
check("unlocatable quotes are dropped, not thrown on", resolved.length, 2);
check(
  "overlapping sources merge onto one range",
  resolved.map((r) => r.value),
  [["objection", "scorecard"], ["buying_signal"]]
);
check(
  "resolved ranges slice back to the expected text",
  resolved.map((r) => TRANSCRIPT.slice(r.start, r.end)),
  ["המחיר גבוה לנו מדי", "אני חותם היום"]
);

const objectionTurn = turns[1];
const localRanges = rangesForTurn(objectionTurn, resolved);
check("only the ranges inside this turn survive", localRanges.length, 1);
check(
  "local range indexes the turn's own text",
  objectionTurn.text.slice(localRanges[0].start, localRanges[0].end),
  "המחיר גבוה לנו מדי"
);
check("a turn with no highlights gets none", rangesForTurn(turns[2], resolved), []);

const segments = segmentText(objectionTurn.text, localRanges);
check(
  "segments reassemble to the original text exactly",
  segments.map((s) => s.text).join(""),
  objectionTurn.text
);
check(
  "exactly one segment carries the mark",
  segments.filter((s) => s.mark !== null).map((s) => s.text),
  ["המחיר גבוה לנו מדי"]
);
check(
  "the marked segment carries BOTH merged sources through to render time",
  segments.find((s) => s.mark !== null)?.mark,
  ["objection", "scorecard"]
);
check("no marks means a single plain segment", segmentText("טקסט רגיל", []), [
  { text: "טקסט רגיל", mark: null },
]);
check("empty text segments to nothing", segmentText("", localRanges), []);

// Layering: later marks win, so a search hit can sit on top of a quote
// highlight without any interval arithmetic.
const layered = segmentText("אבגדהו", [
  { start: 0, end: 6, value: "quote" },
  { start: 2, end: 4, value: "search" },
]);
check(
  "a later mark overwrites an earlier one it sits inside",
  layered,
  [
    { text: "אב", mark: "quote" },
    { text: "גד", mark: "search" },
    { text: "הו", mark: "quote" },
  ]
);
check(
  "out-of-bounds marks are clamped, never crash",
  segmentText("אבג", [{ start: -5, end: 99, value: "x" }]),
  [{ text: "אבג", mark: "x" }]
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
