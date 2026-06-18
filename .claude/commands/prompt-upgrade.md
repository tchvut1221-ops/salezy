# 🔧 Prompt Upgrade — שדרוג מתודי של פרומפטים ב-Salezy

Use this skill when:
- איכות ניתוח לא מספקת (ציונים לא הגיוניים, שדות ריקים, תיאורי אישיות שגויים)
- מוסיפים ידע חדש ל-`lib/sales-knowledge.ts` ורוצים לבדוק שהוא משפר
- משנים מודל AI (GPT-4o → Claude, וכו')
- לפני כל release גדול — ודא שהפרומפט עדיין בסטנדרט גבוה

## תהליך (follow exactly)

### שלב 1: הגדרת מטרה
לפני כל שינוי — ענה על השאלות האלה:
- מה בדיוק לא עובד? (שדה ספציפי? ציון מסוים? סוג שיחה מסוים?)
- מה ה-success criteria? (מה ייראה כמו "עובד"?)
- מה הסיכון? (מה יכול להישבר אם שינוי לא עובד?)

### שלב 2: baseline
```
1. בחר 3 שיחות מבחן מ-docs/test-calls/:
   - easy-call.txt (שיחה פשוטה)
   - medium-call.txt (שיחה בינונית עם התנגדות)
   - hard-call.txt (שיחה קשה, לקוח סקפטי)

2. הרץ ניתוח על כל אחת עם הפרומפט הנוכחי
3. שמור תוצאות baseline:
   - overallScore לכל שיחה
   - האם ה-field שרוצים לשפר מתמלא?
   - האם הציונים הגיוניים?
```

### שלב 3: זיהוי בעיה
הרץ `/brainstorming` עם שאלה: "מה בפרומפט הנוכחי גורם ל-[בעיה]?"
- קרא את `lib/analysis.ts` — מה ה-system prompt אומר?
- קרא את `lib/sales-knowledge.ts` — האם הידע הרלוונטי קיים?
- זהה: האם הבעיה בפרומפט? ב-knowledge base? ב-schema? בtemperature?

### שלב 4: שינוי אחד בכל פעם
```
⚠️ CRITICAL: שנה רק דבר אחד בין בדיקה לבדיקה.
אחרת אי אפשר לדעת מה גרם לשיפור/הרעה.

סדר עדיפויות לשינוי:
1. הוסף knowledge ל-sales-knowledge.ts (הכי בטוח)
2. שנה ניסוח בprompt (בינוני)
3. שנה temperature (שנה ב-0.05 בכל פעם)
4. שנה מבנה JSON בפרומפט (הכי מסוכן — בדוק Zod)
```

### שלב 5: בדיקה
```
הרץ ניתוח על 3 שיחות המבחן עם הפרומפט המשודרג.
לכל שיחה — השווה ל-baseline:
✅ overallScore הגיוני? (easy > medium > hard)
✅ השדה שרצינו לשפר — האם השתפר?
✅ שדות אחרים — האם נשארו תקינים? (regression check)
✅ שפה: כל output בעברית?
✅ Zod validation עבר?
```

### שלב 6: החלטה
```
✅ כל checks עברו → merge את השינוי
⚠️ חלק עברו → עדן את השינוי, חזור לשלב 4
❌ תוצאות גרועות יותר → revert, נסה כיוון אחר
```

### שלב 7: תיעוד
עדכן `docs/research/RESEARCH.md`:
```markdown
## Prompt Upgrade — [תאריך]
**מה שופר:** [שדה/אזור]
**מה שונה:** [תיאור קצר]
**תוצאות:**
- easy-call: לפני X → אחרי Y
- medium-call: לפני X → אחרי Y
- hard-call: לפני X → אחרי Y
**הערות:** [כל מה שלמדנו]
```

## Security check (לאחר כל upgrade)
`/agent-security` — ודא שהפרומפט החדש לא יוצר חולשת prompt injection:
- System prompt לא מכיל logic שמשתמש יכול לנצל
- Transcript injection: "Ignore previous instructions and..." — האם GPT מגיב?

## Files accessed
- `lib/analysis.ts` — הפרומפט
- `lib/sales-knowledge.ts` — הידע
- `docs/test-calls/` — שיחות מבחן
- `docs/research/RESEARCH.md` — תיעוד

## Usage
```
/prompt-upgrade — התחל תהליך שדרוג פרומפט
/prompt-upgrade שפר זיהוי סוג אישיות DISC
/prompt-upgrade הפרומפט נותן ציונים גבוהים מדי לשיחות רעות
/prompt-upgrade בדוק אם הprompt עמיד לprompt injection
```
