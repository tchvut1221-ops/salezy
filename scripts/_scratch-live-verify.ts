/**
 * ONE-OFF live verification — NOT meant to be committed or reused. Deleted
 * right after running. Confirms the merged verbatim-quote + measured-talk-
 * ratio changes work against a real Claude + GPT-4o call before pushing to
 * prod, using the exact production reasoning system prompt against a
 * hand-written but realistic Hebrew sales-call transcript, then feeding the
 * real reasoning text into the real, unmodified synthesizeAnalysis().
 *
 * Note: skips the adaptive `thinking`/`output_config` params (Inngest AI
 * Gateway extensions that only exist inside a real step.ai.infer call) for
 * simplicity — this exercises the same system prompt/model/schema/
 * normalization logic that ships, just without extended thinking depth.
 *
 * Run: npx tsx --env-file=.env.local scripts/_scratch-live-verify.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { synthesizeAnalysis } from "../lib/analysis";
import { SALES_SYSTEM_KNOWLEDGE } from "../lib/sales-knowledge";

const transcript = `דובר 1: שלום, מדבר יוסי ממערכות סיילזי, מדברים עם דנה?
דובר 2: כן זו דנה, שלום.
דובר 1: היי דנה, תודה שהסכמת לשיחה. רציתי להבין קצת יותר לעומק - איך אתם מנהלים היום את מעקב השיחות של אנשי המכירות אצלכם?
דובר 2: כרגע זה די ידני, כל נציג רושם לעצמו הערות ב-CRM אחרי השיחה, אבל זה לא עקבי ולפעמים דברים נופלים בין הכיסאות.
דובר 1: אני שומע, וזה מוביל אותי לשאלה - יש לכם דרך לדעת בוודאות מה קרה בשיחה, למשל אם נציג באמת שאל את השאלות הנכונות בגילוי צרכים?
דובר 2: לא ממש, אנחנו סומכים על מה שהם כותבים.
דובר 1: זה בדיוק הבעיה שאנחנו פותרים. המערכת שלנו מתמללת את השיחה אוטומטית ונותנת ציון מדויק לכל שלב - פתיחה, גילוי צרכים, הצגת פתרון, טיפול בהתנגדויות וסגירה. זה נותן למנהלי צוות תמונה אמיתית בלי לסמוך על זיכרון של אף אחד.
דובר 2: זה נשמע מעניין אבל אני קצת חוששת מהעלות, כמה זה עולה בערך?
דובר 1: אני מבין לגמרי את החשש הזה, וזו שאלה מצוינת. התמחור שלנו הוא לפי מספר נציגים, ובממוצע הלקוחות שלנו רואים החזר השקעה תוך חודשיים בזכות שיפור בשיעורי הסגירה. אם תרצי, אני יכול לשלוח לך הצעת מחיר מפורטת מותאמת לגודל הצוות שלכם.
דובר 2: כן, זה יעזור לי להבין יותר טוב.
דובר 1: מעולה. אז ככה נעשה - אני אשלח לך היום את ההצעה עם דוגמה של דוח ניתוח שיחה אמיתי, ונקבע שיחת המשך לשבוע הבא כדי לענות על שאלות נוספות ולדבר על הצעדים הבאים. מה דעתך על יום שלישי בשעה 10?
דובר 2: יום שלישי בסדר, נתראה אז.
דובר 1: מצוין, אני אשלח הזמנה ליומן ואת ההצעה היום אחר הצהריים. תודה רבה על הזמן דנה.
דובר 2: תודה, נדבר.`;

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
13. מדדי שיחה (רק אם ניתן להעריך מהתמלול): משך משוער בדקות, זיהוי איזו תווית דובר (למשל 'דובר 1') היא איש המכירות — על סמך מי מוביל את השיחה, שואל שאלות גילוי, מציג פתרון ומטפל בהתנגדויות (ציין זאת בבירור בטקסט, למשל 'איש המכירות הוא דובר 1'; אם לא ניתן לזהות בבירור — ציין זאת ואל תנחש), רמת אנרגיה, קצב, וסנטימנט בתחילת/אמצע/סוף השיחה. אם אי אפשר להעריך מדד מסוים — דלג עליו ואל תנחש.
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

async function main() {
  console.log("Calling Claude directly (production system prompt, no extended thinking)...");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: `הנה תמלול השיחה לניתוח:\n\n${transcript}` }],
  });
  const reasoning = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  console.log("\n--- Claude's reasoning (relevant excerpt around section 13) ---");
  const idx = reasoning.indexOf("13");
  console.log(reasoning.slice(Math.max(0, idx - 20), idx + 400));

  console.log("\nCalling the real synthesizeAnalysis() (unmodified, imported from lib/analysis.ts)...");
  const result = await synthesizeAnalysis(reasoning, transcript);

  console.log("\n=== salespersonScorecard ===");
  console.log(JSON.stringify(result.salespersonScorecard, null, 2));

  console.log("\n=== Manual verbatim spot-check ===");
  const sc = result.salespersonScorecard;
  if (sc) {
    for (const key of ["opening", "discovery", "pitch", "objectionHandling", "closing"] as const) {
      const cat = sc[key];
      if (cat?.quote) {
        const found = transcript.includes(cat.quote.replace(/[.,!?]/g, "").trim())
          || transcript.includes(cat.quote);
        console.log(`${key}: quote present in transcript (loose check) = ${found} | "${cat.quote}"`);
      } else {
        console.log(`${key}: no quote (score=${cat?.score})`);
      }
    }
    console.log(`talkRatio: ${JSON.stringify(sc.talkRatio)}`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
