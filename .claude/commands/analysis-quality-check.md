# ✅ Analysis Quality Check — בדיקת איכות ניתוח אוטומטית

Use this skill:
- לפני כל deploy/release
- אחרי שינוי בפרומפט (lib/analysis.ts)
- אחרי שדרוג מודל AI
- אחרי הוספת שדות חדשים ל-schema

## תהליך

### שלב 1: הכנה
```
1. ודא שdocs/test-calls/ מכיל 3 שיחות מבחן:
   - easy-call.txt
   - medium-call.txt
   - hard-call.txt

2. קרא את types/index.ts — מה ה-AnalysisResult schema המלא?
   (חייב לדעת אילו שדות צריכים להיות מלאים)
```

### שלב 2: הרץ ניתוח על 3 שיחות המבחן
```
שיחה 1: easy-call.txt
שיחה 2: medium-call.txt
שיחה 3: hard-call.txt
```
אם אין API גישה ישירה — הרץ באמצעות Inngest test mode.

### שלב 3: Checklist לכל שיחה

**Schema completeness (חובה — אחרת לא deploy):**
```
[ ] executiveSummary: string, length > 50 תווים
[ ] overallScore: number, בין 0-100
[ ] callObjectiveAchieved: 'yes'|'partial'|'no'
[ ] customerPersonality.type: אחד מ-4 ערכים
[ ] customerPersonality.confidence: number, > 30
[ ] customerPersonality.howToSellToThisType: array, length > 0
[ ] callMetrics.talkRatioSalesperson: number, בין 0-100
[ ] callMetrics.sentiment.start: 'positive'|'neutral'|'negative'
[ ] dealStage: אחד מהערכים המוגדרים
[ ] objections: array (יכול להיות ריק לeasy-call)
[ ] salespersonPerformance.overallScore: number, בין 0-100
[ ] salespersonPerformance.scores.needsDiscovery: number
[ ] salespersonPerformance.whatWorked: array, length > 0
[ ] salespersonPerformance.tips: array, length > 0
[ ] customerNeeds.explicit: array, length > 0
[ ] keyMoments: array, length >= 2
[ ] nextSteps: array, length >= 1
```

**Logic checks (warning אם לא עוברים — לא blocking):**
```
[ ] easy-call overallScore > medium-call overallScore (שיחה קלה = ציון גבוה יותר)
[ ] medium-call objections.length > 0 (בשיחה הבינונית יש התנגדות)
[ ] hard-call objections לפחות 2 items
[ ] executiveSummary בעברית (לא אנגלית)
[ ] tips.priority מכיל לפחות אחד 'critical' לhard-call
[ ] nextSteps מכיל לפחות אחד 'urgent' לhard-call
```

**Zod validation:**
```
[ ] ה-Zod schema ב-lib/analysis.ts עובר על 3 התוצאות בלי errors
```

### שלב 4: ציון
```
Schema completeness: X/18 checks
Logic checks: X/7 checks (warning)
Zod validation: pass/fail

PASS: 18/18 schema + Zod pass → מותר לdeploy
WARNING: 15-17/18 schema → תקן, אל תdeploy עם חסרים
FAIL: < 15/18 schema → אסור לdeploy, הרץ /systematic-debugging
```

### שלב 5: אם נכשל
```
הרץ /systematic-debugging עם:
- מה check נכשל?
- מה ה-raw output של GPT-4o לאותה שיחה?
- האם זה Zod validation error? schema error? logic error?
```

## Files accessed
- `docs/test-calls/` — שיחות מבחן
- `lib/analysis.ts` — הפרומפט + Zod schema
- `types/index.ts` — AnalysisResult schema

## Usage
```
/analysis-quality-check — הרץ בדיקה מלאה לפני deploy
/analysis-quality-check after prompt change — בדוק רגרסיה
/analysis-quality-check שיחה קשה בלבד — focus על hard-call
```
