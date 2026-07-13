# Practice Loop — design

## Context

Stage 1 (progressive disclosure — 4 summary cards with "פרטים נוספים", sticky Progress Bar) is already built and merged to `main` (`cfbc9b8`). Each `AnalysisSection` already carries a `practiceEnabled` prop and an inert "תרגל עכשיו" button showing a "בקרוב" tooltip, reserved for this stage.

Stage 2 gives that button real behavior: an AI role-play chat, scoped to what each section is about, ending in short feedback. Zero prior spec existed anywhere in the repo for this beyond the name — brainstormed from scratch with the user, confirmed final 2026-07-13. Built on branch `feat/practice-loop` off `main`, per explicit instruction not to work on `main` directly.

**Explicit constraints from the user:** full RTL (logical properties only) and existing design tokens (`Panel`/`Button`/`tabular-nums`) on every new component; do not touch the AI pipeline (`lib/analysis.ts`, `lib/disc.ts`, `lib/inngest/*`) — this is a new, separate endpoint plus a display layer, not a pipeline change.

## What "practice" means

Each of the 4 sections gets its own practice target (not one shared generic chat):

| Section | Practice focus (the "brief") | Source (already computed in `analysis-sections.tsx`) |
|---|---|---|
| שיחת המכירה | The top-priority coaching action | `topCoachingAction` |
| Follow-up | The weekly focus goal | `weeklyFocus.primaryGoal` |
| סגנון הלקוח | Communicating with this DISC type generally | `customerPersonality.type` |
| Scorecard שלך | The weakest scorecard category | `weakestCategory` |

The simulated customer is **always the same customer from that call** (same DISC type, via `STYLE_PROFILES[type].howToCommunicate`/`redFlags` in `lib/disc-reference.ts` — reused directly, not reauthored). What differs per section is only the conversation's focus/scenario.

**Mechanic:** text-based chat (typed, WhatsApp-style bubbles), not voice — keeps this a synchronous request/response feature, no streaming/STT/TTS infrastructure needed. Conversation is free-flowing; the user paces it and ends it explicitly via a "סיים תרגול" button (not a fixed turn count, not AI-decided). On end, the AI drops character and returns exactly two short lines of feedback — `whatWorked` / `whatToImprove` — not a large structured breakdown like the main analysis. History (chat + feedback) is persisted in a new table for future aggregation across sessions.

**Architecture:** plain synchronous Server Actions calling the Anthropic SDK directly (mirrors `lib/disc.ts`'s `getDiscClient()` pattern — a lazily-instantiated raw `Anthropic` client, no `step.ai.infer`). No Inngest: Inngest exists for durable, retryable, cancellable background jobs (transcription, analysis) — a live back-and-forth chat is a low-latency synchronous interaction, and routing it through Inngest would add polling/realtime round-trip latency for no benefit. No streaming for v1 (pure UX polish, addable later without touching the data model).

## Data model

New migration `supabase/migrations/0015_add_practice_sessions.sql` (next number after `0014`), following `0001_create_analyses.sql`'s exact convention (table + index + `set_updated_at` trigger reused + 4 RLS policies, no Realtime publication needed since the UI holds session state in React during the chat and only persists via Server Actions):

```sql
create table if not exists public.practice_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  analysis_id  uuid not null references public.analyses (id) on delete cascade,
  section_key  text not null check (section_key in ('sales_call','followup','customer_style','scorecard')),
  focus_text   text not null,
  messages     jsonb not null default '[]'::jsonb,
  feedback     jsonb,
  status       text not null default 'in_progress' check (status in ('in_progress','completed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists practice_sessions_user_id_idx on public.practice_sessions (user_id);
create index if not exists practice_sessions_analysis_id_idx on public.practice_sessions (analysis_id);

drop trigger if exists practice_sessions_set_updated_at on public.practice_sessions;
create trigger practice_sessions_set_updated_at
  before update on public.practice_sessions
  for each row execute function public.set_updated_at();

alter table public.practice_sessions enable row level security;
-- select/insert/update/delete own rows, same 4-policy shape as 0001_create_analyses.sql
```

`types/index.ts` additions: `PracticeSectionKey`, `PracticeMessage` (`{ role: "user" | "customer"; content: string }`), `PracticeFeedback` (`{ whatWorked: string; whatToImprove: string }`), `PracticeSession` (row shape).

## Server logic

**`lib/practice.ts`** (new) — mirrors `lib/disc.ts`'s raw-SDK pattern:
- `getPracticeClient()` — lazy `Anthropic` singleton, same shape as `getDiscClient()`.
- `buildPersonaSystemPrompt(sectionKey, brief, personality)` — customer persona from `STYLE_PROFILES[personality.type]` + the section's focus text.
- `sendPracticeTurn(session, userText)` — one Anthropic call, temp ~0.7 (conversational, not extraction), returns the customer's next line.
- `generateFeedback(session)` — one Anthropic call over the full transcript, temp 0.1, JSON-mode, Zod-validated against `{ whatWorked: string, whatToImprove: string }`, parsed via the existing `parseModelJson` from `lib/analysis.ts` (reused, not reimplemented).

**`app/actions.ts`** additions (same shape as `retryAnalysis`/`cancelAnalysis`: auth check via `getUser()`, explicit ownership `select` + comparison as defense-in-depth alongside RLS):
- `startPracticeSession(analysisId, sectionKey, focusText)` — the client passes the already-computed brief text straight through (no server-side re-derivation: unlike `file_path` ownership, a user supplying their own `focusText` crosses no real boundary — they can already steer the conversation to anything once it starts, so re-deriving it server-side would just duplicate `analysis-sections.tsx`'s logic for no actual security gain). Verifies the user owns `analysisId`, inserts the row, gets the AI's opening line, returns the session.
- `sendPracticeMessage(sessionId, text)` — appends the user turn, calls `sendPracticeTurn`, appends and persists the reply.
- `endPracticeSession(sessionId)` — calls `generateFeedback`, persists `feedback` + `status: "completed"`.

## UI

**`components/salezy/practice-dialog.tsx`** (new) — a centered modal (Dialog), chosen over a side panel or dedicated page because practice is a short, focused, in-context action triggered from a specific highlighted point in the analysis, not a navigation destination. Three states in one dialog: start → chat (WhatsApp-style bubbles, input pinned to the bottom, "סיים תרגול" always visible) → feedback (reuses the existing `HighlightRow` helper from `analysis-sections.tsx` for the two feedback lines — same visual language as section 1's strength/improvement highlight, not a new pattern). Built on `Panel`/`Button` design tokens, full RTL via logical properties, numbers (if any — e.g. a session counter later) in `font-mono tabular-nums`.

**`components/salezy/analysis-section.tsx`** — the "תרגל עכשיו" button becomes real (opens `PracticeDialog`) whenever the section actually has a valid brief; otherwise stays inert with the "בקרוב" tooltip exactly as today (e.g. a legacy analysis with no `weeklyFocus` and no `nextSteps` has nothing to practice for the Follow-up section).

**`components/salezy/analysis-sections.tsx`** — computes each section's practice brief from values already computed there (`topCoachingAction`, `weeklyFocus`, `customerPersonality.type`, `weakestCategory`) and passes it down.

## Out of scope for this pass

Streaming responses, voice, aggregation/trends across past practice sessions (the table is designed to support it later, nothing built now), and cross-session analytics.
