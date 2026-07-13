# Practice Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each analysis section's inert "תרגל עכשיו" button into a real AI role-play practice chat (text, WhatsApp-style), scoped to that section's specific focus, ending in short feedback, with history persisted for future aggregation.

**Architecture:** Plain synchronous Next.js Server Actions calling the Anthropic SDK directly (mirrors `lib/disc.ts`'s raw-client pattern) — no Inngest, no streaming. One new Supabase table (`practice_sessions`). One new modal component (Base UI `Dialog`, already an installed dependency, currently unused anywhere in the repo) with 3 states: starting → chat → feedback.

**Tech Stack:** Next.js 16 Server Actions, `@anthropic-ai/sdk` (raw client, same pattern as `lib/disc.ts`), Zod, `@base-ui/react` (`Dialog`), Supabase (Postgres + RLS).

**Spec:** `docs/superpowers/specs/2026-07-13-practice-loop-design.md` (approved, committed `d6ebd9d`). One refinement made during this planning pass beyond the spec: added a `personality_type` column to the table (snapshotting the DISC type at session-creation time) so `sendPracticeMessage` can rebuild the persona system prompt on every turn without an extra join back to `analyses` — consistent with the spec's own "client passes already-computed values, no server re-derivation" principle.

**Branch:** `feat/practice-loop` (already checked out, off `main` which already has stage 1 merged). Never work on `main` directly.

---

### Task 1: Migration — `practice_sessions` table

**Files:**
- Create: `supabase/migrations/0015_add_practice_sessions.sql`
- Modify: `docs/OPS.md` (migration list)

- [ ] **Step 1: Write the migration file**

```sql
-- Salezy: Practice Loop — AI role-play chat sessions tied to a specific
-- analysis section. Run this in the Supabase SQL Editor.

create table if not exists public.practice_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  analysis_id      uuid not null references public.analyses (id) on delete cascade,
  section_key      text not null check (section_key in ('sales_call','followup','customer_style','scorecard')),
  focus_text       text not null,
  personality_type text not null check (personality_type in ('Analytical','Driver','Amiable','Expressive')),
  messages         jsonb not null default '[]'::jsonb,
  feedback         jsonb,
  status           text not null default 'in_progress' check (status in ('in_progress','completed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists practice_sessions_user_id_idx on public.practice_sessions (user_id);
create index if not exists practice_sessions_analysis_id_idx on public.practice_sessions (analysis_id);

-- Reuses the existing set_updated_at() trigger function (defined in
-- 0001_create_analyses.sql) — no need to redefine it.
drop trigger if exists practice_sessions_set_updated_at on public.practice_sessions;
create trigger practice_sessions_set_updated_at
  before update on public.practice_sessions
  for each row execute function public.set_updated_at();

alter table public.practice_sessions enable row level security;

drop policy if exists "select own practice sessions" on public.practice_sessions;
create policy "select own practice sessions" on public.practice_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "insert own practice sessions" on public.practice_sessions;
create policy "insert own practice sessions" on public.practice_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own practice sessions" on public.practice_sessions;
create policy "update own practice sessions" on public.practice_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own practice sessions" on public.practice_sessions;
create policy "delete own practice sessions" on public.practice_sessions
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Update `docs/OPS.md`'s migration list**

In the fenced list under "Current migrations on `main`", add a line after `0014_harden_recordings_bucket.sql`:

```
0015_add_practice_sessions.sql
```

Directly below the existing "**All migrations through `0014` are applied...**" sentence, add:

```markdown
`0015` (new `practice_sessions` table for the Practice Loop feature) is **not yet applied** — this is a brand-new table with no existing code depending on it, so (unlike the ivrit-columns fail-throw case above) it's safe to merge before applying, but must be applied before the practice Server Actions are actually used in production (the first `INSERT` would otherwise fail with a missing-table error).
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_add_practice_sessions.sql docs/OPS.md
git commit -m "feat(practice): add practice_sessions table + RLS"
```

No automated test for this step — this repo applies migrations manually via the Supabase SQL Editor (see `docs/OPS.md`), verified later in Task 9's live check, not via a local test harness.

---

### Task 2: Types

**Files:**
- Modify: `types/index.ts` (append at end of file)

- [ ] **Step 1: Add the new types**

Append to `types/index.ts`:

```ts
export type PracticeSectionKey = "sales_call" | "followup" | "customer_style" | "scorecard";

export interface PracticeMessage {
  role: "user" | "customer";
  content: string;
}

export interface PracticeFeedback {
  whatWorked: string;
  whatToImprove: string;
}

/** A row of the public.practice_sessions table. */
export interface PracticeSession {
  id: string;
  user_id: string;
  analysis_id: string;
  section_key: PracticeSectionKey;
  focus_text: string;
  personality_type: PersonalityType;
  messages: PracticeMessage[];
  feedback: PracticeFeedback | null;
  status: "in_progress" | "completed";
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Run typecheck to confirm no errors**

Run: `npx tsc --noEmit` (from the repo root)
Expected: no output, exit code 0 (this file has no logic to break yet, just confirms the new types parse).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(practice): add PracticeSession types"
```

---

### Task 3: `lib/practice.ts` — pure prompt builders + feedback schema

**Files:**
- Create: `lib/practice.ts`
- Create: `scripts/practice-selftest.ts`

- [ ] **Step 1: Write the failing self-test first**

Create `scripts/practice-selftest.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx scripts/practice-selftest.ts`
Expected: FAIL — `Cannot find module '../lib/practice'` (the file doesn't exist yet).

- [ ] **Step 3: Write `lib/practice.ts`'s pure parts**

Create `lib/practice.ts`:

```ts
import { z } from "zod";
import { STYLE_PROFILES, PERSONALITY_TYPE_META } from "@/lib/disc-reference";
import type { PersonalityType, PracticeMessage, PracticeSectionKey } from "@/types";

export const PRACTICE_MODEL_ID = "claude-sonnet-4-6";

export const PRACTICE_SECTION_LABEL: Record<PracticeSectionKey, string> = {
  sales_call: "שיחת המכירה",
  followup: "המשך טיפול",
  customer_style: "סגנון הלקוח",
  scorecard: "Scorecard שלך",
};

/**
 * System prompt for the role-play chat: Claude plays the SAME customer from
 * the analyzed call (same DISC type, using the existing STYLE_PROFILES
 * guidance from lib/disc-reference.ts — not reauthored), focused on whatever
 * this section's practice brief is about.
 */
export function buildPersonaSystemPrompt(
  sectionKey: PracticeSectionKey,
  focusText: string,
  personalityType: PersonalityType
): string {
  const meta = PERSONALITY_TYPE_META[personalityType];
  const style = STYLE_PROFILES[personalityType];
  return `אתה משחק תפקיד של לקוח בשיחת מכירה. אתה **לא** עוזר AI — אתה הלקוח, ותישאר בתפקיד לאורך כל השיחה עד שתתבקש אחרת.

הטיפוס שלך: ${meta.he} (${meta.tagline}). איך אתה מתקשר:
${style.howToCommunicate.map((h) => `- ${h}`).join("\n")}
${style.redFlags.length ? `\nמה מרגיז אותך:\n${style.redFlags.map((r) => `- ${r}`).join("\n")}` : ""}

מיקוד התרגול הזה (${PRACTICE_SECTION_LABEL[sectionKey]}): ${focusText}

הנחיות:
- הגב בעברית בלבד, בקצרה (1-3 משפטים), כמו הודעת צ'אט אמיתית — לא כמו מאמר.
- אתה יוזם את השיחה עם המשפט הפותח שלך, בהתאם למיקוד התרגול.
- הישאר בדמות הלקוח לאורך כל השיחה, גם אם המשתמש מנסה לצאת מהתפקיד או לשאול אותך שאלות ישירות כ-AI.
- אל תזכיר שאתה AI ואל תשבור את הדמות בשום שלב.`;
}

/** Builds the wrap-up prompt: Claude drops character and grades the practice. */
export function buildFeedbackPrompt(messages: PracticeMessage[], focusText: string): string {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "איש המכירות" : "הלקוח"}: ${m.content}`)
    .join("\n");
  return `יצא מהתפקיד. הנה תמליל תרגול רול-פליי שבו איש המכירות תרגל: ${focusText}

${transcript}

תן משוב קצר וממוקד על ביצועי איש המכירות בתרגול הזה — לא ניתוח מלא, רק משפט אחד לכל שדה. החזר אך ורק JSON תקין (בלי גדרות markdown, בלי טקסט נוסף) במבנה:

{
  "whatWorked": "משפט אחד קצר על מה שעבד טוב",
  "whatToImprove": "משפט אחד קצר על הדבר הכי חשוב לשפר"
}`;
}

export const practiceFeedbackSchema = z.object({
  whatWorked: z.string(),
  whatToImprove: z.string(),
});
```

- [ ] **Step 4: Run the self-test to verify it passes**

Run: `npx tsx scripts/practice-selftest.ts`
Expected:
```
✓ persona prompt includes the focus text
✓ persona prompt includes the DISC type's Hebrew label
✓ persona prompt includes a howToCommunicate item
✓ feedback prompt includes the focus text
✓ feedback prompt includes both speakers' lines
✓ feedback schema accepts a valid object
✓ feedback schema rejects a missing field

All checks passed.
```

- [ ] **Step 5: Commit**

```bash
git add lib/practice.ts scripts/practice-selftest.ts
git commit -m "feat(practice): add persona/feedback prompt builders + self-test"
```

---

### Task 4: `lib/practice.ts` — Anthropic client + chat/feedback calls

**Files:**
- Modify: `lib/practice.ts`

These calls hit the real Anthropic API — not unit-testable without secrets (same as `lib/disc.ts`'s `detectSignsOnce`). Verified live in Task 9, not here.

- [ ] **Step 1: Add the raw Anthropic client + the two API-calling functions**

Append to `lib/practice.ts` (add the import at the top alongside the existing ones):

```ts
import Anthropic from "@anthropic-ai/sdk";
import { parseModelJson } from "@/lib/analysis";
```

Then append at the bottom of the file:

```ts
// Lazy singleton, mirrors lib/disc.ts's getDiscClient() pattern exactly.
let practiceClient: Anthropic | null = null;
function getPracticeClient(): Anthropic {
  if (!practiceClient) practiceClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return practiceClient;
}

/** One chat turn: sends the full conversation so far, returns the customer's next line. */
export async function sendPracticeTurn(
  systemPrompt: string,
  messages: PracticeMessage[]
): Promise<string> {
  const res = await getPracticeClient().messages.create({
    model: PRACTICE_MODEL_ID,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    max_tokens: 300,
    temperature: 0.7,
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Wrap-up call: Claude drops character, returns Zod-validated short feedback. */
export async function generateFeedback(
  messages: PracticeMessage[],
  focusText: string
) {
  const res = await getPracticeClient().messages.create({
    model: PRACTICE_MODEL_ID,
    system: "אתה מספק משוב מכירתי קצר וממוקד. תמיד מחזיר JSON תקין בלבד, בלי גדרות markdown.",
    messages: [{ role: "user", content: buildFeedbackPrompt(messages, focusText) }],
    max_tokens: 500,
    temperature: 0.1,
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return practiceFeedbackSchema.parse(parseModelJson(text));
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/practice.ts
git commit -m "feat(practice): add Anthropic chat turn + feedback generation"
```

---

### Task 5: Server Actions

**Files:**
- Modify: `app/actions.ts`

- [ ] **Step 1: Add imports**

At the top of `app/actions.ts`, add alongside the existing imports:

```ts
import {
  buildPersonaSystemPrompt,
  sendPracticeTurn,
  generateFeedback,
} from "@/lib/practice";
import type {
  PracticeSectionKey,
  PracticeSession,
  PracticeMessage,
  PracticeFeedback,
} from "@/types";
```

(`PersonalityType` is already importable from `@/types`; add it to the existing `import type { AnalysisStatus } from "@/types";` line, making it `import type { AnalysisStatus, PersonalityType } from "@/types";`.)

- [ ] **Step 2: Add `startPracticeSession`**

Append to `app/actions.ts`:

```ts
/**
 * Starts a new practice session: verifies the user owns `analysisId` (the
 * only thing worth re-checking server-side — sectionKey/focusText/
 * personalityType are trusted display values the client already computed
 * from that same analysis, no security boundary crosses if they're
 * user-supplied, so no point re-deriving them here), gets the AI's opening
 * line, and persists the session.
 */
export async function startPracticeSession(
  analysisId: string,
  sectionKey: PracticeSectionKey,
  focusText: string,
  personalityType: PersonalityType
): Promise<PracticeSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select("id, user_id")
    .eq("id", analysisId)
    .single();
  if (analysisError || !analysis || analysis.user_id !== user.id) {
    throw new Error("Analysis not found");
  }

  const systemPrompt = buildPersonaSystemPrompt(sectionKey, focusText, personalityType);
  const opening = await sendPracticeTurn(systemPrompt, [
    { role: "user", content: "(התחל את השיחה כלקוח, במשפט פתיחה טבעי אחד)" },
  ]);

  const { data, error } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: user.id,
      analysis_id: analysisId,
      section_key: sectionKey,
      focus_text: focusText,
      personality_type: personalityType,
      messages: [{ role: "customer", content: opening }] satisfies PracticeMessage[],
      status: "in_progress",
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to start practice session");

  return data as PracticeSession;
}
```

- [ ] **Step 3: Add `sendPracticeMessage`**

Append:

```ts
/** Sends one user turn, appends the AI's reply, persists the full updated session. */
export async function sendPracticeMessage(
  sessionId: string,
  text: string
): Promise<PracticeSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error || !session || session.user_id !== user.id) {
    throw new Error("Practice session not found");
  }
  if (session.status !== "in_progress") {
    throw new Error("Practice session already ended");
  }

  const systemPrompt = buildPersonaSystemPrompt(
    session.section_key,
    session.focus_text,
    session.personality_type
  );
  const updatedMessages: PracticeMessage[] = [
    ...(session.messages as PracticeMessage[]),
    { role: "user", content: text },
  ];
  const reply = await sendPracticeTurn(systemPrompt, updatedMessages);
  updatedMessages.push({ role: "customer", content: reply });

  const { data: updated, error: updateError } = await supabase
    .from("practice_sessions")
    .update({ messages: updatedMessages })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select()
    .single();
  if (updateError || !updated) throw updateError ?? new Error("Failed to send message");

  return updated as PracticeSession;
}
```

- [ ] **Step 4: Add `endPracticeSession`**

Append:

```ts
/** Ends a session: generates short feedback, marks the session completed. */
export async function endPracticeSession(sessionId: string): Promise<PracticeFeedback> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error || !session || session.user_id !== user.id) {
    throw new Error("Practice session not found");
  }
  if (session.status !== "in_progress") {
    throw new Error("Practice session already ended");
  }

  const feedback = await generateFeedback(session.messages as PracticeMessage[], session.focus_text);

  const { error: updateError } = await supabase
    .from("practice_sessions")
    .update({ feedback, status: "completed" })
    .eq("id", sessionId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;

  return feedback;
}
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This will fail until migration 0015 types are reflected — but since `practice_sessions` isn't in any generated Supabase types file in this repo (checked: no `database.types.ts` exists, `.from()` calls are untyped/`any`-ish throughout `app/actions.ts` already), there's nothing to regenerate — the explicit `as PracticeSession`/`as PracticeMessage[]` casts above are exactly how this repo already handles the same untyped-client situation elsewhere, e.g. `data as Analysis` in `app/analysis/[id]/page.tsx`.)

- [ ] **Step 6: Commit**

```bash
git add app/actions.ts
git commit -m "feat(practice): add start/send/end Server Actions"
```

---

### Task 6: Export `HighlightRow` for reuse in the feedback view

**Files:**
- Modify: `components/salezy/analysis-sections.tsx`

- [ ] **Step 1: Export the existing helper**

`HighlightRow` already exists in this file (built in stage 1) but is not exported. Find:

```ts
function HighlightRow({
```

Change to:

```ts
export function HighlightRow({
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (adding `export` never breaks existing same-file usages).

- [ ] **Step 3: Commit**

```bash
git add components/salezy/analysis-sections.tsx
git commit -m "refactor(practice): export HighlightRow for reuse in practice feedback"
```

---

### Task 7: `PracticeDialog` component

**Files:**
- Create: `components/salezy/practice-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "./ui";
import { HighlightRow } from "./analysis-sections";
import {
  startPracticeSession,
  sendPracticeMessage,
  endPracticeSession,
} from "@/app/actions";
import type {
  PracticeSectionKey,
  PracticeSession,
  PracticeFeedback,
  PersonalityType,
} from "@/types";

type DialogState =
  | { phase: "starting" }
  | { phase: "chat"; session: PracticeSession; isWaitingForReply: boolean; isEnding: boolean }
  | { phase: "feedback"; feedback: PracticeFeedback }
  | { phase: "error"; message: string };

/**
 * The Practice Loop modal. Base UI's Dialog (components/salezy/ui.tsx notes
 * this project has zero existing modal component despite @base-ui/react
 * already being a dependency — this is the first user of it) gives real focus
 * trapping/ESC/backdrop-dismiss for free, which a hand-rolled div wouldn't,
 * and is justified here unlike this app's existing plain window.confirm()
 * dialogs — this is a genuinely stateful, multi-turn surface.
 */
export function PracticeDialog({
  open,
  onOpenChange,
  analysisId,
  sectionKey,
  focusText,
  personalityType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  sectionKey: PracticeSectionKey;
  focusText: string;
  personalityType: PersonalityType;
}) {
  const [state, setState] = useState<DialogState>({ phase: "starting" });
  const [draft, setDraft] = useState("");

  // Kick off a fresh session every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setState({ phase: "starting" });
    setDraft("");
    startPracticeSession(analysisId, sectionKey, focusText, personalityType)
      .then((session) =>
        setState({ phase: "chat", session, isWaitingForReply: false, isEnding: false })
      )
      .catch(() =>
        setState({ phase: "error", message: "לא הצלחנו להתחיל את התרגול. נסו שוב." })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-running on analysisId/sectionKey/focusText/personalityType change is correct, but open is the actual trigger
  }, [open]);

  async function onSend() {
    if (state.phase !== "chat" || !draft.trim() || state.isWaitingForReply) return;
    const text = draft.trim();
    const sessionId = state.session.id;
    setDraft("");
    setState({ ...state, isWaitingForReply: true });
    try {
      const updated = await sendPracticeMessage(sessionId, text);
      setState({ phase: "chat", session: updated, isWaitingForReply: false, isEnding: false });
    } catch {
      setState({ phase: "error", message: "לא הצלחנו לשלוח את ההודעה. נסו שוב." });
    }
  }

  async function onEnd() {
    if (state.phase !== "chat" || state.isEnding) return;
    const sessionId = state.session.id;
    setState({ ...state, isEnding: true });
    try {
      const feedback = await endPracticeSession(sessionId);
      setState({ phase: "feedback", feedback });
    } catch {
      setState({ phase: "error", message: "לא הצלחנו לסיים את התרגול. נסו שוב." });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Popup className="fixed start-1/2 top-1/2 z-50 flex max-h-[80vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          {state.phase === "starting" && (
            <p className="text-sm text-zinc-400">מתחילים תרגול...</p>
          )}

          {state.phase === "error" && (
            <>
              <p className="text-sm text-score-low">{state.message}</p>
              <Button variant="secondary" onClick={() => onOpenChange(false)} className="mt-4">
                סגור
              </Button>
            </>
          )}

          {state.phase === "chat" && (
            <>
              <Dialog.Title className="text-lg font-semibold text-foreground">
                תרגול: {focusText}
              </Dialog.Title>

              <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
                {state.session.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "ms-auto bg-primary text-primary-foreground"
                        : "me-auto bg-zinc-800 text-zinc-100"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {state.isWaitingForReply && (
                  <p className="text-xs text-zinc-500">הלקוח מקליד...</p>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  disabled={state.isWaitingForReply || state.isEnding}
                  placeholder="הקלד תגובה..."
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-foreground placeholder:text-zinc-600"
                />
                <Button
                  onClick={onSend}
                  disabled={state.isWaitingForReply || state.isEnding || !draft.trim()}
                >
                  שלח
                </Button>
              </div>

              <Button
                variant="secondary"
                onClick={onEnd}
                disabled={state.isEnding}
                className="mt-3"
              >
                {state.isEnding ? "מסיים..." : "סיים תרגול"}
              </Button>
            </>
          )}

          {state.phase === "feedback" && (
            <>
              <Dialog.Title className="text-lg font-semibold text-foreground">
                משוב על התרגול
              </Dialog.Title>
              <div className="mt-4 space-y-3">
                <HighlightRow tone="positive" label="מה עבד" text={state.feedback.whatWorked} />
                <HighlightRow
                  tone="negative"
                  label="מה לשפר"
                  text={state.feedback.whatToImprove}
                />
              </div>
              <Button onClick={() => onOpenChange(false)} className="mt-6">
                סגור
              </Button>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Note on chat-bubble alignment: `me-auto` (margin-inline-end: auto) pushes an element toward the **start** side, which is the **right** in RTL — used here for the salesperson's own ("user") messages. `ms-auto` pushes toward the **end** (left in RTL) — used for the AI customer's messages. This is a one-line class swap if it looks wrong once seen live in Task 9 — flag it explicitly during that check.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/salezy/practice-dialog.tsx
git commit -m "feat(practice): add PracticeDialog (start/chat/feedback states)"
```

---

### Task 8: Wire `AnalysisSection`'s "תרגל עכשיו" button

**Files:**
- Modify: `components/salezy/analysis-section.tsx`

- [ ] **Step 1: Replace the always-inert button with a real conditional one**

Find this block in `components/salezy/analysis-section.tsx`:

```tsx
export interface AnalysisSectionProps {
  /** Section heading. */
  title: string;
  /** The 2-3 key highlights — always visible. ReactNode (not string[]) so scores
   *  render in JetBrains Mono / signal colors and the DISC headline keeps its style. */
  summary: ReactNode;
  /** Expanded content, hidden by default. When absent the "פרטים נוספים" toggle
   *  is not rendered (a summary-only section, e.g. a degraded legacy analysis). */
  details?: ReactNode;
  /** Part of the component API for stage 2 (Practice Loop). Stage 1 intentionally
   *  ignores it: there is no practice flow to launch yet, so "תרגל עכשיו" is always
   *  inert with a "בקרוב" tooltip. Wiring stage 2 = read this here, no call-site churn. */
  practiceEnabled?: boolean;
  /** Fires on every expand/collapse so the parent can drive the Progress Bar. */
  onOpenChange?: (open: boolean) => void;
}

export function AnalysisSection({
  title,
  summary,
  details,
  onOpenChange,
}: AnalysisSectionProps) {
```

Replace with:

```tsx
export interface AnalysisSectionProps {
  /** Section heading. */
  title: string;
  /** The 2-3 key highlights — always visible. ReactNode (not string[]) so scores
   *  render in JetBrains Mono / signal colors and the DISC headline keeps its style. */
  summary: ReactNode;
  /** Expanded content, hidden by default. When absent the "פרטים נוספים" toggle
   *  is not rendered (a summary-only section, e.g. a degraded legacy analysis). */
  details?: ReactNode;
  /** Stage 2 (Practice Loop): whether this section actually has something to
   *  practice (e.g. a legacy analysis with no weeklyFocus has nothing for the
   *  Follow-up section). When false, "תרגל עכשיו" stays inert with the
   *  "בקרוב" tooltip exactly as in stage 1. */
  practiceEnabled?: boolean;
  /** Fires when "תרגל עכשיו" is clicked while practiceEnabled is true. The
   *  parent (AnalysisSections) owns the actual PracticeDialog instance. */
  onPracticeClick?: () => void;
  /** Fires on every expand/collapse so the parent can drive the Progress Bar. */
  onOpenChange?: (open: boolean) => void;
}

export function AnalysisSection({
  title,
  summary,
  details,
  practiceEnabled = false,
  onPracticeClick,
  onOpenChange,
}: AnalysisSectionProps) {
```

- [ ] **Step 2: Replace the always-inert "תרגל עכשיו" button**

Find:

```tsx
        {/* aria-disabled (not the real `disabled` attribute) keeps the button
            hoverable so the native title tooltip shows, and keeps it in the tab
            order announced as disabled — a real disabled button suppresses both. */}
        <Button
          variant="secondary"
          aria-disabled
          title="בקרוב"
          onClick={(e) => e.preventDefault()}
          className="cursor-not-allowed opacity-50 hover:border-zinc-700 hover:text-zinc-300"
        >
          תרגל עכשיו
        </Button>
```

Replace with:

```tsx
        {practiceEnabled ? (
          <Button variant="secondary" onClick={onPracticeClick}>
            תרגל עכשיו
          </Button>
        ) : (
          // aria-disabled (not the real `disabled` attribute) keeps the button
          // hoverable so the native title tooltip shows, and keeps it in the tab
          // order announced as disabled — a real disabled button suppresses both.
          <Button
            variant="secondary"
            aria-disabled
            title="בקרוב"
            onClick={(e) => e.preventDefault()}
            className="cursor-not-allowed opacity-50 hover:border-zinc-700 hover:text-zinc-300"
          >
            תרגל עכשיו
          </Button>
        )}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/salezy/analysis-section.tsx
git commit -m "feat(practice): wire תרגל עכשיו to open a practice session when enabled"
```

---

### Task 9: Compute per-section practice briefs + render `PracticeDialog`

**Files:**
- Modify: `components/salezy/analysis-sections.tsx`
- Modify: `components/salezy/analysis-view.tsx`

- [ ] **Step 1: Pass `analysisId` down from `AnalysisView`**

In `components/salezy/analysis-view.tsx`, find:

```tsx
        ) : isReady && analysis.result ? (
          <AnalysisSections result={analysis.result} />
        ) : (
```

Replace with:

```tsx
        ) : isReady && analysis.result ? (
          <AnalysisSections analysisId={initial.id} result={analysis.result} />
        ) : (
```

- [ ] **Step 2: Update `AnalysisSections`'s props and imports**

In `components/salezy/analysis-sections.tsx`, find:

```tsx
import { PERSONALITY_TYPE_ICON, ICON_STROKE_WIDTH } from "./icons";
import type { AnalysisResult, CoachingPriority, ScorecardCategoryKey } from "@/types";
```

Replace with:

```tsx
import { PERSONALITY_TYPE_ICON, ICON_STROKE_WIDTH } from "./icons";
import { PracticeDialog } from "./practice-dialog";
import type {
  AnalysisResult,
  CoachingPriority,
  ScorecardCategoryKey,
  PracticeSectionKey,
} from "@/types";
```

Find:

```tsx
export function AnalysisSections({ result }: { result: AnalysisResult }) {
```

Replace with:

```tsx
export function AnalysisSections({
  analysisId,
  result,
}: {
  analysisId: string;
  result: AnalysisResult;
}) {
```

- [ ] **Step 3: Add practice-target state**

Right after the existing `openedIds` state declaration (find `const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(new Set());`), add:

```tsx
  const [practiceTarget, setPracticeTarget] = useState<{
    sectionKey: PracticeSectionKey;
    focusText: string;
  } | null>(null);
```

- [ ] **Step 4: Wire section 1 (שיחת המכירה)**

Find the `sections` array's first entry:

```tsx
    {
      id: "sales-call",
      title: "שיחת המכירה",
      summary: section1Summary,
      details: section1Details as ReactNode | undefined,
    },
```

Replace with:

```tsx
    {
      id: "sales-call",
      title: "שיחת המכירה",
      summary: section1Summary,
      details: section1Details as ReactNode | undefined,
      practiceEnabled: Boolean(improvement),
      onPracticeClick: () =>
        improvement && setPracticeTarget({ sectionKey: "sales_call", focusText: improvement }),
    },
```

- [ ] **Step 5: Wire section 2 (Follow-up)**

Find:

```tsx
    {
      id: "followup",
      title: "Follow-up",
      summary: section2Summary,
      details: section2Details,
    },
```

Replace with:

```tsx
    {
      id: "followup",
      title: "Follow-up",
      summary: section2Summary,
      details: section2Details,
      practiceEnabled: Boolean(weeklyFocus),
      onPracticeClick: () =>
        weeklyFocus &&
        setPracticeTarget({ sectionKey: "followup", focusText: weeklyFocus.primaryGoal }),
    },
```

(Practice is tied specifically to `weeklyFocus` — a rehearsable behavior goal — not the `nextSteps` fallback used for the summary text, which is often a logistical action like "send a quote," not something to role-play.)

- [ ] **Step 6: Wire section 3 (סגנון הלקוח)**

Find:

```tsx
    {
      id: "customer-style",
      title: "סגנון הלקוח",
      summary: <CustomerStyleSummary personality={result.customerPersonality} />,
      details: section3Details as ReactNode | undefined,
    },
```

Replace with:

```tsx
    {
      id: "customer-style",
      title: "סגנון הלקוח",
      summary: <CustomerStyleSummary personality={result.customerPersonality} />,
      details: section3Details as ReactNode | undefined,
      practiceEnabled: true,
      onPracticeClick: () =>
        setPracticeTarget({
          sectionKey: "customer_style",
          focusText: `לתרגל תקשורת עם לקוח מסוג ${PERSONALITY_TYPE_META[result.customerPersonality.type].he}`,
        }),
    },
```

(Always enabled — `customerPersonality` is a mandatory v1-core field, always present, unlike the other three sections' v2-only data.)

- [ ] **Step 7: Wire section 4 (Scorecard שלך)**

Find:

```tsx
    {
      id: "scorecard",
      title: "Scorecard שלך",
      summary: section4Summary,
      details: section4Details,
    },
```

Replace with:

```tsx
    {
      id: "scorecard",
      title: "Scorecard שלך",
      summary: section4Summary,
      details: section4Details,
      practiceEnabled: Boolean(weakestCategory),
      onPracticeClick: () =>
        weakestCategory &&
        setPracticeTarget({
          sectionKey: "scorecard",
          focusText: `לתרגל שיפור ב${SCORECARD_CATEGORY_LABEL[weakestCategory.key]}`,
        }),
    },
```

- [ ] **Step 8: Pass the new props through to `AnalysisSection` and render `PracticeDialog`**

Find:

```tsx
      {sections.map((s, i) => (
        <div key={s.id} className="animate-fade-up" style={DELAY(i)}>
          <AnalysisSection
            title={s.title}
            summary={s.summary}
            details={s.details}
            onOpenChange={(open) => {
              if (open) markOpened(s.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}
```

Replace with:

```tsx
      {sections.map((s, i) => (
        <div key={s.id} className="animate-fade-up" style={DELAY(i)}>
          <AnalysisSection
            title={s.title}
            summary={s.summary}
            details={s.details}
            practiceEnabled={s.practiceEnabled}
            onPracticeClick={s.onPracticeClick}
            onOpenChange={(open) => {
              if (open) markOpened(s.id);
            }}
          />
        </div>
      ))}

      <PracticeDialog
        open={practiceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPracticeTarget(null);
        }}
        analysisId={analysisId}
        sectionKey={practiceTarget?.sectionKey ?? "sales_call"}
        focusText={practiceTarget?.focusText ?? ""}
        personalityType={result.customerPersonality.type}
      />
    </div>
  );
}
```

- [ ] **Step 9: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If TypeScript complains that the `sections` array's inferred element type doesn't uniformly include `practiceEnabled`/`onPracticeClick` (some entries have them, all should now), double check every one of the 4 entries from Steps 4-7 was updated — a partial edit is the most likely cause of a type error here.

- [ ] **Step 10: Commit**

```bash
git add components/salezy/analysis-sections.tsx components/salezy/analysis-view.tsx
git commit -m "feat(practice): compute per-section practice briefs, render PracticeDialog"
```

---

### Task 10: Full static gate + live verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full static gate**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all three exit 0. If `next build` fails with a phantom "Cannot find module" referencing a route that doesn't exist, `rm -rf .next` first (documented repo gotcha — a stale `.next/dev` type cache from a previous throwaway dev-preview route).

- [ ] **Step 2: Run the self-test**

```bash
npx tsx scripts/practice-selftest.ts
```

Expected: `All checks passed.`

- [ ] **Step 3: Live-verify via a throwaway preview route**

Real OTP login can't be automated here (same reasoning as stage 1 — entering an emailed auth code on the user's behalf is treated like handling a credential, not something to script). Build a throwaway `app/dev-preview-practice-loop/page.tsx` rendering `<AnalysisSections analysisId="test-id" result={SAMPLE} />` with a hand-built `AnalysisResult` (reuse the `RICH_SAMPLE` shape from stage 1's now-deleted `dev-preview-progressive-disclosure` route, or construct fresh — must include `coachingActions`, `weeklyFocus`, `customerPersonality`, and `salespersonScorecard` so all 4 sections have `practiceEnabled: true`). Start the dev server, open the route, and check:

- Clicking "תרגל עכשיו" on each of the 4 sections opens the dialog with the right `focusText` in the title and the AI's opening line already showing (confirms `startPracticeSession`'s synthetic-kickoff mechanism works and the real Anthropic call succeeds).
- Typing a reply and clicking "שלח" shows the customer's next in-character reply (confirms `sendPracticeMessage`).
- Clicking "סיים תרגול" shows the 2-line feedback (`HighlightRow` positive/negative), confirms `endPracticeSession` + Zod validation succeeds against a real model response, not just the self-test's synthetic JSON.
- Chat bubble alignment (`me-auto` for the user/salesperson, `ms-auto` for the AI customer — see Task 7's note) actually looks right once rendered; flip the two classes if not.
- ESC key and clicking the backdrop both close the dialog (Base UI `Dialog`'s built-in behavior — confirms it's wired correctly, not just visually present).
- No console/network errors (`read_console_messages`, `read_network_requests`).
- RTL is correct throughout (Hebrew right-to-left, input/button order matches the rest of the app).

Delete the throwaway route immediately after and `rm -rf .next` again if `next build` shows the same phantom-module symptom from Step 1.

- [ ] **Step 4: Re-run the static gate one final time on the clean tree**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all three exit 0, with `git status --short` showing no leftover throwaway files.

- [ ] **Step 5: Report back**

Summarize what was verified and stop — do not merge or push to `main` without the user's explicit go-ahead (this repo's standing rule: `main` auto-deploys to production on every push).

---

## Self-review notes

- **Spec coverage:** every section of the design doc has a corresponding task — data model (Task 1), types (Task 2), persona/feedback logic (Tasks 3-4), Server Actions (Task 5), UI (Tasks 6-9), verification (Task 10). No gaps found.
- **Type consistency:** `PracticeMessage.role` (`"user" | "customer"`) is used identically in `lib/practice.ts`, `app/actions.ts`, and `practice-dialog.tsx` — the only place it's translated is `sendPracticeTurn`'s internal mapping to Anthropic's `"user" | "assistant"`, which stays fully inside `lib/practice.ts` and never leaks out. `PracticeFeedback`'s two fields (`whatWorked`/`whatToImprove`) match across the Zod schema, the type, and `HighlightRow`'s usage in `practice-dialog.tsx`.
- **No placeholders:** every step above has complete, runnable code — nothing deferred to "handle appropriately."
