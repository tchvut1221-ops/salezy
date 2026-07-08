/**
 * DISC calibration reference data — the Sean Hakri word-pair method.
 *
 * Ground truth for the quantitative DISC engine (lib/disc.ts): two 17-pair word
 * questionnaires (each pair mapped to one pole of one axis) plus the per-type
 * "how to communicate" / "how he thinks" guidance (Part 4 of the source method).
 * Encoded as data — not prose — so the scoring engine can deterministically map
 * detected signs to axis scores instead of relying on an LLM's holistic judgment.
 *
 * Word-pair lists confirmed against the original source 2026-07-08 (Questionnaire A
 * required a correction pass — see plan swirling-squishing-clover.md for the
 * before/after). Owned by this feature; not part of the /agent-data knowledge flow.
 */

import type { PersonalityType } from "@/types";

export interface WordPair {
  /** The word/phrase indicating this pole. */
  pole1: string;
  /** The word/phrase indicating the opposite pole. */
  pole2: string;
}

/**
 * Questionnaire A — Formal ↔ Informal (vertical axis). pole1 = Formal, pole2 = Informal.
 * Maps to `axes.responsiveness`: Formal → "task", Informal → "people".
 */
export const FORMAL_INFORMAL_PAIRS: WordPair[] = [
  { pole1: "שיטתי", pole2: "אקראי" },
  { pole1: "מחושב", pole2: "ספונטני" },
  { pole1: "חוסם (שומר בבטן)", pole2: "מבטא" },
  { pole1: "בוחן", pole2: "אימפולסיבי" },
  { pole1: "מרוחק", pole2: "קרוב" },
  { pole1: "מאופק", pole2: "מלא חיים" },
  { pole1: "בשליטה עצמית", pole2: "נינוח, משוחרר" },
  { pole1: "מאורגן", pole2: "בלתי מאורגן" },
  { pole1: "מובנה", pole2: "בלתי מובנה" },
  { pole1: "נוקשה", pole2: "גמיש" },
  { pole1: "מעונב", pole2: "לא רשמי" },
  { pole1: "שכלתני", pole2: "רגשני" },
  { pole1: "בלתי זמין", pole2: "זמין" },
  { pole1: "ממוקד", pole2: "בלתי ממוקד" },
  { pole1: "שגרתי", pole2: "לא שועה לסמכויות" },
  { pole1: "ממושמע", pole2: "מפזר" },
  { pole1: "מאורגן", pole2: "בלתי מאורגן" },
];

/**
 * Questionnaire B — Dominant ↔ Passive (horizontal axis). pole1 = Dominant, pole2 = Passive.
 * Maps to `axes.assertiveness`: Dominant → "high", Passive → "low".
 */
export const DOMINANT_PASSIVE_PAIRS: WordPair[] = [
  { pole1: "לוקח פיקוד", pole2: "מצטרף" },
  { pole1: "מוכן", pole2: "מהסס" },
  { pole1: "מאתגר", pole2: "מקבל בהבנה" },
  { pole1: "מכריע", pole2: "מתבייש" },
  { pole1: "מוחצן", pole2: "מופנם" },
  { pole1: "רועש", pole2: "שקט" },
  { pole1: "יזם", pole2: "משלים" },
  { pole1: "אומר את שלו", pole2: "נסוג" },
  { pole1: "דוחף", pole2: "מאופק" },
  { pole1: "דברן", pole2: "מקשיב" },
  { pole1: "מצהיר הצהרות", pole2: "שואל שאלות" },
  { pole1: "גלוי", pole2: "סמוי" },
  { pole1: "מתווכח", pole2: "מסכים" },
  { pole1: "משתלט", pole2: "נשלט" },
  { pole1: "מזדרז", pole2: "כבד" },
  { pole1: "מבטא", pole2: "מבליע" },
  { pole1: "מתרחב", pole2: "מצטמצם" },
];

export interface StyleProfile {
  /** Hebrew display label — MUST stay in sync with personality-card.tsx's TYPE_META. */
  he: string;
  colorName: string;
  /** Positive, actionable guidance for selling to this type. */
  howToCommunicate: string[];
  /** Cautionary "what not to do" items, kept separate from howToCommunicate. */
  redFlags: string[];
  /** Behavioral description — how this type thinks/decides. Reference only. */
  howHeThinks: string[];
}

/**
 * Part 4 of the source method: per-quadrant "how to communicate" tables. Split
 * into positive guidance (howToCommunicate) vs. explicit avoid-items (redFlags)
 * as they appeared in the source; nothing here is invented beyond that split.
 */
export const STYLE_PROFILES: Record<PersonalityType, StyleProfile> = {
  Amiable: {
    he: "תומך",
    colorName: "ירוק",
    howToCommunicate: [
      "לשבור את הקרח בתחילת השיחה",
      "להתחבר ברמה רגשית",
      "לאפשר לו את הקצב האיטי והרגוע",
      "לחייך ולהיות חברותי",
      "להוביל בתהליך ברוגע ולעזור לו להתקדם יחד איתך",
      "לאמץ גישת \"אין לחץ\" — זו הגישה שהוא רוצה לראות",
    ],
    redFlags: [],
    howHeThinks: [
      "נינוח, חביב, נמנע מכל סכסוך",
      "נותן לאחרים ליזום",
      "לא כופה את השקפת עולמו על אחרים",
      "נוטה לאבד עניין בתכנון והצבת יעדים",
      "זקוק להגדרה מדויקת של המשימה שעליו להשלים",
    ],
  },
  Expressive: {
    he: "מבטא",
    colorName: "צהוב",
    howToCommunicate: [
      "קצב מהיר",
      "לעזור לו להרגיש טוב בתהליך — גם במכירה וגם בשירות או במוצר עצמו",
      "סיפורים, בדיחות, חוויות, מקרי מבחן",
      "חשוב לו לקבל השראה וליהנות מהתהליך",
      "לתת לו לדבר",
      "שיחה לא פורמלית, אנרגיה גבוהה",
    ],
    redFlags: [
      "לא לתת לו להוריד אותך מהמסלול",
      "לא לנסות להיות תכליתי מדי וקצר",
      "לא להטביע אותו בפרטים",
    ],
    howHeThinks: [
      "מתחבר עם אנשים במצבים משתנים בתדירות גבוהה ובמהירות",
      "פתוח, נלהב, ורבלי",
      "אוהב פעילות מלהיבה ומעוררת השראה",
      "לא נוטה לנתח לעומק",
      "נוטה להכללות ללא מידע עובדתי מספיק, ולהגזמה",
      "ספונטני, חברותי, לא אוהב פרטים",
      "יכול לחשוב בקול",
      "נוטה לקפוץ מדבר לדבר ולא להשלים משימות",
      "מנסה להתבלט, חושב שתפיסת מקום בצמרת מוכיחה ערך עצמי",
    ],
  },
  Analytical: {
    he: "אנליטי",
    colorName: "כחול",
    howToCommunicate: [
      "לדבר תהליך, צעדים, פרטים ונתונים",
      "לצפות שהוא יבקש הרבה נתונים ולאפשר לו לקבל אותם במידה סבירה",
      "לדבר על עובדות ונתונים שחשובים לו",
      "לתת לו ביטחון שההחלטה מושכלת ועבורו",
    ],
    redFlags: [
      "לא להיכנס לרגשות",
      "להימנע מלהפוך ל\"חוקר\" (מודיעין)",
      "לא להתקרב מדי בלי מגע",
    ],
    howHeThinks: [
      "ניגש למצבים בגישת פתרון בעיות",
      "נוטה לעובדות ונתונים ופחות לתחושות",
      "יציב, מהוסס, מרוסן, שקט, איטי",
      "בדרך כלל ממתין שיפנו אליו, לא פונה בעצמו",
      "אוסף נתונים בטרם יקבל החלטת קנייה",
      "חרטת קנייה נפוצה אצלו — ממשיך לאסוף מידע ונתונים גם אחרי הקנייה",
      "נוטה להיסגר לעצמו",
      "חשוב לו לא לטעות ולקבל את ההחלטה הבטוחה והמושכלת",
      "נמנע מסכסוכים, יכול להצטייר כמרוחק",
      "קשה לו להחליט",
    ],
  },
  Driver: {
    he: "משימתי",
    colorName: "אדום",
    howToCommunicate: [
      "קצר, ענייני",
      "לדבר תוצאות, שורה תחתונה",
      "לאפשר לו להביע את דעתו",
    ],
    redFlags: [
      "בלי קשקושים",
      "לא לבזבז לו את הזמן ולא להיכנס לפן הרגשי",
      "לא להימרח \"מסביב לעניין\"",
      "לא לנסות להוכיח אותו — נפסיד בכל מצב",
      "לעולם אל תבטיח משהו שלא נוכל לקיים בוודאות",
    ],
    howHeThinks: [
      "קצר, ענייני, ממוקד בתוצאות",
      "עצמאי, פעיל, בטוח בעצמו",
      "אוהב להחליט, מוביל, בעל רצון חזק",
      "קשה לו להפגין רגש",
      "משליט סדר ומשיג תוצאות",
      "לעיתים לא מודע/מתייחס לאופן שבו המסר מתקבל",
      "נטייה לחוסר סבלנות",
    ],
  },
};

/** Quadrant lookup: (assertiveness, responsiveness) → PersonalityType. */
export const QUADRANT_MAP: Record<"high" | "low", Record<"task" | "people", PersonalityType>> = {
  high: { people: "Expressive", task: "Driver" },
  low: { people: "Amiable", task: "Analytical" },
};

function formatPairList(pairs: WordPair[], pole1Label: string, pole2Label: string): string {
  return pairs
    .map((p, i) => `${i + 1}. ${p.pole1} (${pole1Label}) | ${p.pole2} (${pole2Label})`)
    .join("\n");
}

/**
 * Builds the focused system prompt for scoreDiscAxes(): pure sign-detection against
 * the two word-pair questionnaires above. Deliberately narrow — this call has ONE
 * job (find signs + quote them), unlike the old holistic DISC section embedded in
 * the 15-section reasoning prompt.
 */
export function renderDiscPrompt(): string {
  return `אתה מזהה סימנים לשוניים בתמלול שיחת מכירה בעברית, לפי שיטת שני שאלוני מילים-מנוגדות. המשימה שלך היא זיהוי בלבד — לא שיפוט הוליסטי של אישיות.

לכל אחד משני הצירים למטה, יש 17 זוגות מילים מנוגדות. עבור על התמלול וחפש ביטויים של הדובר-לקוח (לא איש המכירות) שמתאימים לאחד מהצדדים של זוג כלשהו — או מקבילים סמנטיים בעברית מדוברת (למשל "בוא נזוז" מקביל ל"דוחף"/"מאתגר" גם בלי להשתמש במילה המדויקת).

⚠️ לכל סימן שתזהה: חובה ציטוט מילולי קצר ומדויק מהתמלול (verbatim — בדיוק כפי שנאמר, לא ניסוח מחדש). אם אין ציטוט אמיתי — אל תדווח על הסימן. אל תמציא ואל תגזים בכמות הסימנים; דווח רק על מה שקיים בפועל בתמלול. עדיף מעט סימנים אמיתיים מהרבה סימנים מפוקפקים.

────────────────────────────
ציר 1 — רשמי ↔ בלתי-רשמי (עמודה 1 = "formal", עמודה 2 = "informal"):
${formatPairList(FORMAL_INFORMAL_PAIRS, "formal", "informal")}

────────────────────────────
ציר 2 — דומיננטי ↔ פאסיבי (עמודה 1 = "dominant", עמודה 2 = "passive"):
${formatPairList(DOMINANT_PASSIVE_PAIRS, "dominant", "passive")}

────────────────────────────
החזר אך ורק JSON תקין (בלי טקסט נוסף, בלי גדרות markdown) במבנה הבא:

{
  "formalInformalSigns": [
    { "quote": "ציטוט מילולי מהתמלול", "pairNumber": 1, "pole": "formal" }
  ],
  "dominantPassiveSigns": [
    { "quote": "ציטוט מילולי מהתמלול", "pairNumber": 1, "pole": "dominant" }
  ]
}

- "pairNumber" הוא המספר (1-17) של הזוג המתאים ביותר מהרשימה למעלה, גם כשהציטוט הוא מקביל סמנטי ולא המילה המדויקת.
- "pole" חייב להיות בדיוק אחד מ: "formal"/"informal" (ציר 1) או "dominant"/"passive" (ציר 2), לפי איזה צד של הזוג הסימן תומך בו.
- אין מספר מינימלי או מקסימלי של סימנים — דווח על כל מה שנמצא בפועל, גם אם זה מעט מאוד או הרבה.
- שני המערכים יכולים להיות ריקים אם אין סימנים רלוונטיים בציר מסוים.`;
}
