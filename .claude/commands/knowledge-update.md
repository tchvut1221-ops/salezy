# 📚 Knowledge Update — הוספת ידע מכירות ל-Salezy

Use this skill when:
- למדת מתודולוגיית מכירות חדשה שרוצים להוסיף
- משוב מלקוחות מגלה gap בניתוח (למשל: "הAI לא זיהה שהלקוח שלי ישבני")
- research מ-agent-research מצא insight חדש
- הפרומפט נכשל בסוג שיחה ספציפי שאפשר ללמד

## תהליך

### שלב 1: הגדרת הידע החדש
הרץ `/brainstorming` עם:
- מה הידע החדש?
- איפה הוא ייכנס ב-`lib/sales-knowledge.ts`? (constant קיים? constant חדש?)
- האם הוא סותר ידע קיים? (אם כן — עצור, דון)
- מה ה-impact הצפוי על הניתוח?

### שלב 2: בדיקת קונפליקטים
קרא את `lib/sales-knowledge.ts` כולו.
- האם הידע החדש סותר משהו קיים?
- האם הוא כפילות של משהו קיים?
- האם הוא מרחיב משהו קיים (→ הוסף לconstant קיים) או שונה לחלוטין (→ constant חדש)?

### שלב 3: כתיבת הידע

**כלל עיצוב constants:**
```typescript
// ✅ טוב: ספציפי, עם דוגמאות, עם הנחיות לפעולה
export const NEW_KNOWLEDGE = `
[שם הנושא]:
- עובדה ספציפית + איך לנצל אותה בניתוח
- דוגמה מהשדה: "[ציטוט לדוגמה]" → משמעות: [...]
- Signal לזיהוי: [מה לחפש בtranscript]
- Impact על ציון: [מה זה אומר לperformance score]
`

// ❌ גרוע: כללי ומעורפל
export const NEW_KNOWLEDGE = `
הידע הזה חשוב למכירות.
`
```

**אל תמחק:**
```typescript
// ❌ אסור:
// export const DISC_GUIDE = `...` ← מחיקה

// ✅ מותר — הוספה בלבד:
export const DISC_GUIDE = `...existing content...
[תוכן חדש שנוסף]
`
```

### שלב 4: בדיקת impact
הרץ `/prompt-upgrade` עם הידע החדש:
- בדוק שהידע החדש **משפר** את הניתוח על שיחות רלוונטיות
- בדוק **regression**: שיחות אחרות לא נפגעות

### שלב 5: הרץ Quality Check
`/analysis-quality-check` — ודא שscores עדיין הגיוניים.

### שלב 6: תיעוד
עדכן `docs/research/RESEARCH.md`:
```markdown
## Knowledge Update — [תאריך]
**ידע שנוסף:** [שם הconstant + תיאור קצר]
**מקור:** [מחקר? משוב לקוח? ספר מכירות?]
**Impact:** [מה השתפר בניתוח]
```

## Security Check
לאחר עדכון `lib/sales-knowledge.ts` — הרץ `/agent-security` (לא grep ידני).
`/agent-security` מכסה: secrets, PII, JWT tokens, anon keys (`eyJ...`), service role keys —
grep ידני מפספס JWT-format keys שלא מתחילות ב-`sk-`.
הקובץ הזה נכנס ל-server bundle — כל leak = exposure בproduction.

## Files accessed
- `lib/sales-knowledge.ts`
- `docs/research/RESEARCH.md`
- (דרך /prompt-upgrade): `lib/analysis.ts`, `docs/test-calls/`

## Usage
```
/knowledge-update הוסף SPIN Selling methodology
/knowledge-update הוסף זיהוי לקוח ישבני (ולא Driver)
/knowledge-update הוסף rubric לניקוד שלב סגירה
/knowledge-update משוב: הAI לא מזהה נכון Expressive
```
