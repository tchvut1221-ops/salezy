# Salezy — מלאי עיבוד נתונים (Data Processing Inventory)

מסמך פנימי-תפעולי: מהו כל פריט מידע במערכת, היכן הוא חי, מי מעבד אותו, כמה זמן הוא נשמר ואיך הוא נמחק. **חובה לעדכן מסמך זה בכל שינוי ארכיטקטוני שנוגע לנתונים** — מדיניות הפרטיות וה-DPA מפנים אליו. תקופות השמירה נאכפות על ידי `lib/inngest/retention.ts` לפי הקבועים ב-`lib/retention-policy.ts`.

| # | פריט | היכן נוצר | היכן מאוחסן | מי מעבד אותו (צד ג') | שמירה | מסלול מחיקה |
|---|---|---|---|---|---|---|
| 1 | קובץ הקלטה גולמי (אודיו/וידאו) | העלאת משתמש (TUS) | Supabase Storage, דלי `recordings` פרטי, נתיב `<user_id>/<uuid>/<file>` | Supabase (אחסון); OpenAI Whisper (תמלול) | **30 יום מההעלאה** (60 אם העיבוד לא הגיע לסטטוס סופי) | סריקת retention לילית מוחקת ומחתימה `audio_deleted_at`; או מחיקת הניתוח ע"י המשתמש |
| 2 | תמלול (כולל `דובר N`) | פלט תמלול | Postgres `analyses.transcript` (RLS per-user) | Anthropic Claude (ניתוח); OpenAI GPT-4o (סינתזה); Inngest (step state) | עד מחיקה ע"י המשתמש | מחיקת הניתוח / החשבון |
| 3 | פלט reasoning של Claude | שלב הניתוח | Postgres `analyses.reasoning` | OpenAI GPT-4o (מקבל אותו לסינתזה); Inngest (step state) | עד מחיקה ע"י המשתמש | מחיקת הניתוח |
| 4 | תוצר ניתוח (ציונים, DISC, ציטוטים, המלצות) | סינתזה + מנוע DISC | Postgres `analyses.result`, `analyses.scores` | — (נוצר אצלנו; עובר ללקוח בלבד) | עד מחיקה ע"י המשתמש | מחיקת הניתוח |
| 5 | כתובת דוא"ל | הרשמה/התחברות | Supabase Auth (`auth.users`); `otp_codes.email`; `otp_rate_limits.email` | Resend (משלוח קוד); Supabase | חשבון — עד סגירה; `otp_codes` — 24ש'; `otp_rate_limits` — 7 ימים | סריקת retention (OTP); סגירת חשבון ⚖️ |
| 6 | כתובת IP | בקשות התחברות | `otp_rate_limits.ip` | Vercel (לוגי בקשות, קצר) | 7 ימים | סריקת retention לילית |
| 7 | קוד OTP (hash בלבד) | שליחת קוד | `otp_codes.code_hash` | Resend (הקוד הגולמי במייל) | עד 24 שעות | סריקת retention לילית |
| 8 | לוגים טכניים (ללא תוכן שיחה) | ריצת המערכת | Vercel Logs, Inngest Dashboard | Vercel, Inngest | לפי מדיניות הספק | אוטומטי אצל הספק |
| 9 | תיעוד הסכמה לתנאים (consent log) | אימות OTP ראשון לאחר checkbox | Postgres `consent_log` (service-role בלבד) | — | כל חיי החשבון (ראיה משפטית) | סגירת חשבון ⚖️ [לשקול שמירה סטטוטורית] |

**כללי מפתח שהקוד אוכף:**
- שום תוכן שיחה (תמלול/ציטוטים/פלט מודל) לא נכתב ללוגים — רק אורכים ומטא-נתונים.
- הודעות שגיאה הנשמרות בשורת `analyses.error` הן גנריות; השגיאה הגולמית נשארת בלוגי השרת בלבד.
- כל גישת service-role לקבצים מאומתת מול תיקיית הבעלים (`file_path.startsWith(user_id + "/")`).
- אין אנליטיקה/טלמטריה של צד שלישי בצד הלקוח.
