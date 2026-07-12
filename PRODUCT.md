# Salezy — Product Vision

## What is it
A web app that analyzes sales call recordings using AI.
Salesperson uploads a recording → gets transcription + psychological analysis.

## Target User
Individual salespeople in Israel. Not enterprises.
Price: 200 NIS/month subscription.

## Analysis
**Core (every analysis):**
1. Customer personality — Analytical / Driver / Amiable / Expressive
2. Salesperson performance — what worked, what didn't, actionable tips
3. Customer needs — explicit and implicit signals from the call

**Enriched (when the AI has enough signal in the call):**
4. Executive summary + call objective (achieved / partial / not achieved)
5. Overall score (0-100) + sub-scores: needs discovery, objection handling, listening ratio, closing
6. Deal stage (discovery / demo / objection / negotiation / close)
7. Buying signals, competitors mentioned, objection-by-objection handling quality
8. Key moments (buying signals / objections / pain points / breakthroughs) with quotes
9. Prioritized next steps (urgent / soon / when possible) with reasoning
10. Dashboard trend — score-per-call chart + aggregate stats (call count, average score, improvement, dominant personality type) across all of a user's analyses
11. Salesperson Scorecard + coaching — a deliberate shift from "call analyzer" to "sales coach": 6 quote-anchored categories (opening/discovery/pitch/objection handling/closing/talk ratio) grading the SALESPERSON (not just profiling the customer), a weekly coaching plan, a per-call Stage Analysis timeline (sentiment + failure point per stage), and a Patterns page surfacing recurring trends once a user has 3+ scored calls. Customer-personality classification (item 1) now runs on a dedicated quantitative DISC engine (word-pair method) rather than being inferred holistically by the LLM.

## Revenue Milestones
- Stage 1: 3,000 NIS/month (15 paying users)
- Stage 2: 10,000 NIS/month (50 users)
- Stage 3: 20,000 NIS/month (100 users)

## Roadmap
Phase 1 (MVP): File upload + analysis + landing page + dashboard analytics — done
Phase 2: Real-time recording on mobile
Phase 3: Zoom/Meet integration
Phase 4: Teams

## Design Principles
- 70% functionality, 30% design
- Clean, modern, not corporate
- Mobile-first
- Dark mode preferred
- Hebrew UI

## Roadmap: Call Centers (מוקדים) & Cross-Customer Learning

> נכתב 2026-07: החלטות מוצר מסוכמות עם המייסד, לצד מדיניות הפרטיות/DPA
> (`docs/legal/`). **שום דבר בפרק זה לא בנוי** — הוא מתעד את הכיוון ואת
> התנאים המשפטיים/טכניים שכל שלב דורש, כדי שלא נבנה אותו בדיעבד על תשתית
> שלא תומכת בו. שים לב: זה חורג מ״Target User: Individual salespeople...
> Not enterprises״ למעלה — כיוון המוצר בבדיקה, לא סתירה שטרם נפתרה.

**שלב 1 (הבסיס הקיים) — Per-user, למידה תוך-לקוח בלבד ✅** המצב היום: כל
חשבון רואה רק את נתוניו (RLS), עמוד "דפוסים" והסטטיסטיקות מחושבים אך ורק
משיחות החשבון עצמו, אין שום קוד שקורא נתונים חוצה-משתמשים, ואין אימון
מודלים. מדיניות הפרטיות וה-DPA מתחייבים לכך במפורש — כל פיצ'ר עתידי חייב
לא לשבור את ההתחייבות הזו בלי עדכון מסמכים והסכמה מחודשת.

**שלב 2 — מודל ארגון (מוקד):** טבלאות `organizations` / `organization_members`
(תפקידים owner/manager/agent), שיוך `analyses.organization_id`, RLS ברמת
ארגון (נציג רואה את שלו, מנהל רואה את המוקד כולו, אף שאילתה לא חוצה ארגון),
דשבורד מנהל להשוואת נציגים — עדיין בתוך הארגון בלבד (עדיין "למידה
תוך-לקוח", כשהלקוח = הארגון). משפטית: "הלקוח" ב-DPA הופך מהמשתמש הבודד
לארגון — נדרש עדכון תנאי שימוש ותהליך הזמנת עובדים עם יידוע.

**שלב 3 — למידה חוצת-לקוחות (אנונימית, opt-in):** תנאים מצטברים: הסכמה
מפורשת נפרדת (opt-in, לא ברירת מחדל) של כל ארגון משתתף; שכבת אנונימיזציה
(הסרת ישויות מזהות לפני צבירה, צבירה סטטיסטית בלבד — אין ציטוטים
חוצי-לקוחות לעולם); DPIA מתועד לפני הפעלה; הפרדת אחסון ללא קשר-חוזר
לשורות המקור; עדכון מדיניות פרטיות + DPA + הודעה מוקדמת ללקוחות קיימים.

**שיפורי תשתית פרטיות (עצמאיים, לפי הזדמנות):** הרשמה ל-OpenAI Zero Data
Retention; צמצום PII ב-step state של Inngest; retention מותאם-לקוח (כולל
"מחק אודיו מיד אחרי תמלול" — הקבועים כבר ב-`lib/retention-policy.ts`);
מחיקת חשבון בשירות עצמי; מינוי DPO אם/כאשר היקף הפעילות יחייב לפי תיקון
13; אימות אזורי עיבוד של כל ספק + עיגון מנגנון העברות בינ"ל לפני חתימת
לקוח מוסדי ראשון.
