# Research Log — Salezy

מסמכי מחקר שנוצרו ע"י `/agent-research`. כל מחקר נוצר לפני החלטת טכנולוגיה.

---

## Research #1: שירותי Transcription לעברית (Whisper vs Deepgram vs AssemblyAI)
**תאריך:** 2026-06-18
**הפעיל:** Avihu — שאלה ישירה
**רקע:** ה-schema הפרמיום החדש דורש `talkRatioSalesperson` (% מזמן הדיבור של איש המכירות).
זה **בלתי אפשרי בלי speaker diarization** — והWhisper הנוכחי (`whisper-1`) לא תומך. לכן הבחירה בשירות transcription היא קריטית לפיצ'ר.

### אפשרויות שנבדקו

| שירות | מחיר/דקה | עברית | Diarization | Latency | אותו vendor? |
|-------|----------|-------|-------------|---------|--------------|
| **Whisper-1 (נוכחי)** | $0.006 | ✅ טוב | ❌ אין | בינוני | ✅ OpenAI |
| **GPT-4o Transcribe + Diarization** | $0.006 | ✅ נתמך | ✅ מובנה (ללא תוספת) | בינוני | ✅ OpenAI |
| **Deepgram Nova-3** | $0.0052 (multilingual) | ✅ production RTL (חדש) | ✅ מובנה | ⚡ הכי מהיר | ❌ |
| **AssemblyAI Universal-2** | $0.0025 + $0.00033 diarization | ✅ נתמך | ✅ (95 שפות) | בינוני | ❌ |

### ניתוח

**Whisper-1 (נוכחי):** עובד טוב לעברית אבל **חוסם את הפיצ'ר** — בלי diarization אין talk-ratio,
אין זיהוי "מי דיבר מתי", אין אפשרות לחשב סנטימנט per-speaker. צריך להחליף.

**GPT-4o Transcribe + Diarization:** השדרוג הכי פשוט — **אותו מחיר** ($0.006/min), **אותו vendor**
(כבר משתמשים ב-OpenAI SDK), מוסיף speaker labels ללא תוספת מחיר. שינוי קוד מינימלי ב-`lib/whisper.ts`.

**Deepgram Nova-3:** הזול והמהיר ביותר. עברית נוספה כ-RTL production-grade. diarization מובנה.
חיסרון: vendor חדש (SDK חדש, API key חדש, אינטגרציה חדשה ב-Inngest). שווה בקנה מידה גדול.

**AssemblyAI:** הזול ביותר בבסיס ($0.0025) אבל features מצטברים. עברית חדשה (Universal-2). vendor חדש.

### ✅ המלצה

**שלב 1 (עכשיו):** עבור ל-**GPT-4o Transcribe with Diarization**.
- אותו מחיר, אותו vendor — שינוי של ~10 שורות ב-`lib/whisper.ts`
- פותח מיד את `talkRatioSalesperson` ואת המטריקות per-speaker בschema החדש
- סיכון נמוך, validation מהיר על 3 שיחות מבחן

**שלב 2 (אם עלות/מהירות נהיות בעיה בקנה מידה):** הערך מעבר ל-**Deepgram Nova-3**
(~13% זול יותר + הכי מהיר). אבל רק אחרי שמוכיחים traction — לא כדאי להוסיף vendor שני מוקדם.

**⚠️ חובה לפני החלפה:** הרץ benchmark דיוק עברית על 3 שיחות אמיתיות. אף ספק לא מפרסם WER לעברית
ספציפי — חייבים למדוד בעצמנו. שמור את התמלולים ב-`docs/test-calls/`.

---

## Research #2: GPT-4o vs Claude Sonnet לניתוח שיחות מכירה בעברית
**תאריך:** 2026-06-18
**הפעיל:** Avihu — שאלה ישירה
**רקע:** מנוע הניתוח (`lib/analysis.ts`) משתמש ב-GPT-4o. השאלה: האם Claude מדייק יותר
בזיהוי אישיות DISC ובניתוח התנגדויות בעברית?

### ממצאי benchmark

**יתרון Claude — הבנה ופרשנות טקסט:**
- Reasoning Over Text: **Claude 87.1%** — הגבוה ביותר. קריטי לזיהוי אישיות מניואנסים בשיחה
- GPQA (חשיבה אנליטית): Claude 59.4% vs GPT-4o 53.6%
- חזק יותר בכתיבה ובהבנת הקשר מתמשך — בדיוק מה שצריך ל-DISC ול-objection subtlety

**יתרון GPT-4o — אמינות פלט מובנה (JSON):**
- שגיאות JSON: GPT-4o **<0.1%** vs Claude <0.5% (עם tool_use)
- אכיפת schema בזמן generation, אינטגרציה ישירה עם Pydantic/Zod
- 24% מהיר יותר בתגובה

**ממצא קריטי (חוצה-מודלים):**
> כשכופים על LLM פלט JSON נוקשה תוך כדי חשיבה, הביצועים צונחים ב-10-15% במשימות ניתוח מורכבות.
> Best practice: **שלב 1 — חשיבה חופשית (ללא אילוצים) → שלב 2 — המרה ל-JSON מובנה.**

זה **בדיוק** ה-2-call pipeline שכבר תוכנן ב-`agent-pipeline.md`:
`extract-raw-data` (temp 0.1) → `analyze-synthesize` (temp 0.3). המחקר מאשר את הארכיטקטורה.

### ✅ המלצה

**ההבדל בין המודלים פחות חשוב ממה שנדמה — היתרון התחרותי האמיתי הוא `lib/sales-knowledge.ts`**
(הזרקת ידע DISC + הקשר ישראלי + objection rubrics). מודל גנרי בלי הידע הזה = מתחרה. מודל עם הידע = Salezy.

**ארכיטקטורה מומלצת (hybrid, ממצה את החוזקות):**
```
Step "extract-reason"  → Claude Sonnet 4.x (temp 0.3)
   חשיבה חופשית: זיהוי אישיות, ניתוח התנגדויות, פרשנות ניואנסים בעברית
   (כאן Claude מנצח — Reasoning Over Text 87.1%)

Step "synthesize-json" → GPT-4o (temp 0.1, JSON mode)
   המרת הניתוח ל-AnalysisResult schema תקין
   (כאן GPT-4o מנצח — <0.1% JSON errors, Zod-friendly)
```

**אבל — אל תקפוץ ל-hybrid מיד.** סדר פעולות:
1. **קודם:** השאר GPT-4o לשני השלבים (כבר עובד). הוסף את `sales-knowledge.ts`.
2. הרץ `/prompt-upgrade` — מדוד baseline על 3 שיחות מבחן.
3. **אז:** A/B — החלף את step החשיבה ל-Claude Sonnet 4.x, מדוד שוב.
4. אם Claude משפר זיהוי DISC/objections באופן מובהק → עבור ל-hybrid. אם לא → חסוך את המורכבות.

**הערה על מודלים:** "Claude Sonnet 4" → הגרסה העדכנית היא **claude-sonnet-4-6** (כבר מופיע ב-CLAUDE.md).
לחשיבה עמוקה אפשר גם Opus 4.x, אבל Sonnet 4.6 הוא נקודת האיזון מחיר/איכות לפר-call.

---

## מחקרים פתוחים (TODO)

- [ ] benchmark עלות per analysis (transcription + 2 GPT calls combined)
- [x] ספריית גרפים: **Recharts** — נבחר ויושם בשלב C (`components/salezy/score-chart.tsx`). אומת תאימות peer-dep עם React 19 (`"react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"`) לפני ההתקנה; Tremor נשאר fallback שלא היה צריך.
- [ ] PDF export ב-Vercel: react-pdf vs puppeteer (לא נכלל ב-MVP הנוכחי — Stages A-D)
- [ ] ניתוח מתחרים: Gong, Avoma, Wingman — feature gaps ל-Salezy

---

## מקורות (Research #1 + #2)

**Transcription:**
- [Deepgram: Hebrew on Nova-3](https://deepgram.com/learn/speech-to-text-for-hebrew-persian-urdu-on-nova-3)
- [Deepgram Pricing](https://deepgram.com/pricing)
- [AssemblyAI: 99 Languages incl. Hebrew](https://www.assemblyai.com/blog/99-languages)
- [AssemblyAI Pricing](https://www.assemblyai.com/pricing)
- [Whisper API Pricing + GPT-4o Transcribe Diarization](https://diyai.io/ai-tools/speech-to-text/openai-whisper-api-pricing-2026/)

**LLM Analysis:**
- [Claude Sonnet vs GPT-4o — Vellum](https://www.vellum.ai/blog/claude-3-5-sonnet-vs-gpt4o)
- [Claude vs GPT-4o — Galileo](https://galileo.ai/blog/claude-3-5-sonnet-vs-gpt-4o-enterprise-ai-model-comparison)
- [Best LLM for JSON Output — DeployBase](https://deploybase.ai/articles/best-llm-for-json-output-structured-data-generation)
- [Structured Outputs guide — Agenta](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
