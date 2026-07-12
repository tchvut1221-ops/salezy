# Doc Drift Fixes (Audit Item 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three stale docs flagged by the 2026-07-09 audit (`CLAUDE.md`, `PRODUCT.md`, `README.md`) — the last open item from that audit.

**Architecture:** Three independent file edits, no shared plumbing. Not code — no test framework applies; verification is a factual read-through against what's actually shipped (already confirmed today), not a static gate.

**Tech Stack:** Markdown only.

**Spec:** `docs/superpowers/specs/2026-07-10-doc-drift-design.md`

**Starting branch:** `feature/docs-update` (off `main`, spec already committed as `b19d57a`).

---

### Task 1: `CLAUDE.md`

**Files:** Modify `CLAUDE.md`

- [ ] **Step 1: Fix the auth line**

Find:

```
- Auth: Magic Link via Supabase Auth
```

Replace with:

```
- Auth: custom OTP (8-digit code generated server-side, emailed via Resend, redeemed for a real Supabase session — see `app/api/auth/send-otp`/`verify-otp`)
```

- [ ] **Step 2: Replace the "Current MVP Scope" section**

Find:

```
## Current MVP Scope
1. Public landing page (`app/page.tsx`) → magic-link login → upload audio file → store in Supabase Storage
2. Inngest pipeline: convert (if needed) → transcribe with ivrit.ai on Runpod (OpenAI `gpt-4o-transcribe-diarize` fallback) → reason with Claude Sonnet 4.6 → synthesize to JSON with GPT-4o (Zod-validated against `AnalysisResult`)
3. Analysis output — v1 core (always present): customer personality type / salesperson performance / customer needs. v2 enriched fields (present when the model produces them; UI degrades gracefully if absent): executive summary, overall score + 4 sub-scores, deal stage, buying signals, competitors, objections with handling score, key moments, prioritized next steps, call metrics
4. Display results in `/analysis/[id]` via `components/salezy/analysis-view.tsx` — rotating status messages + skeleton screens while processing, premium v2 cards (or legacy 3-card fallback) on completion
5. Dashboard (`/dashboard`) — stats bar + score-trend chart (`lib/analytics.ts`, `components/salezy/stats-bar.tsx`, `score-chart.tsx`) aggregated from each analysis's flat `scores` snapshot, plus the analysis list
```

Replace with:

```
## Current Scope
1. Public landing page (`app/page.tsx`) → OTP login → upload audio file → store in Supabase Storage
2. Inngest pipeline: convert (if needed) → transcribe with ivrit.ai on Runpod (OpenAI `gpt-4o-transcribe-diarize` fallback) → reason with Claude Sonnet 4.6 → synthesize to JSON with GPT-4o (Zod-validated against `AnalysisResult`) → DISC customer-personality scoring (dedicated quantitative engine, `lib/disc.ts` — not LLM-holistic)
3. Analysis output — v1 core (always present): customer personality type / salesperson performance / customer needs. v2 enriched fields (present when the model produces them; UI degrades gracefully if absent): executive summary, overall score + 4 sub-scores, deal stage, buying signals, competitors, objections with handling score, key moments, prioritized next steps, call metrics
4. Salesperson Scorecard — 6 quote-anchored categories (opening/discovery/pitch/objectionHandling/closing/talkRatio), verbatim-verified against the transcript, plus a weekly Coaching Plan (`components/salezy/scorecard.tsx`, `coaching-plan.tsx`)
5. Stage Analysis — chronological 5-stage timeline with per-stage sentiment + failure point (`components/salezy/stage-analysis.tsx`)
6. Display results in `/analysis/[id]` via `components/salezy/analysis-view.tsx` — rotating status messages + skeleton screens while processing, premium v2 cards (or legacy 3-card fallback) on completion
7. Dashboard (`/dashboard`) — stats bar + score-trend chart (`lib/analytics.ts`, `components/salezy/stats-bar.tsx`, `score-chart.tsx`) aggregated from each analysis's flat `scores` snapshot, plus the analysis list
8. Patterns (`/patterns`) — deterministic pattern detection across a user's scored calls (3+ call gate), `lib/patterns.ts`
```

- [ ] **Step 3: Drop PDF export from "What NOT to build yet"**

Find:

```
## What NOT to build yet
- Real-time recording, mobile app, Zoom integration, team features, payments, PDF export
```

Replace with:

```
## What NOT to build yet
- Real-time recording, mobile app, Zoom integration, team features, payments
```

(A print-CSS-based PDF button already exists in `analysis-view.tsx` — the item no longer belongs on a "not yet" list.)

- [ ] **Step 4: Read-through check**

Re-read the full file. Confirm every remaining claim (Stack section, Architecture Rules, Security, Code Standards, Agents table) still matches reality — no further edits expected here, this is a sanity pass, not a new editing pass.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add CLAUDE.md
git commit -m "docs: fix stale auth description and missing features in CLAUDE.md

Auth was documented as Magic Link (actual: custom OTP). Current
Scope was missing everything shipped since the original MVP write-up
— Scorecard, Stage Analysis, Coaching Plan, Patterns, DISC engine.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `PRODUCT.md`

**Files:** Modify `PRODUCT.md`

- [ ] **Step 1: Add item 11 to the Analysis section**

Find:

```
10. Dashboard trend — score-per-call chart + aggregate stats (call count, average score, improvement, dominant personality type) across all of a user's analyses

## Revenue Milestones
```

Replace with:

```
10. Dashboard trend — score-per-call chart + aggregate stats (call count, average score, improvement, dominant personality type) across all of a user's analyses
11. Salesperson Scorecard + coaching — a deliberate shift from "call analyzer" to "sales coach": 6 quote-anchored categories (opening/discovery/pitch/objection handling/closing/talk ratio) grading the SALESPERSON (not just profiling the customer), a weekly coaching plan, a per-call Stage Analysis timeline (sentiment + failure point per stage), and a Patterns page surfacing recurring trends once a user has 3+ scored calls. Customer-personality classification (item 1) now runs on a dedicated quantitative DISC engine (word-pair method) rather than being inferred holistically by the LLM.

## Revenue Milestones
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add PRODUCT.md
git commit -m "docs: add Scorecard/Stage Analysis/Coaching/Patterns to PRODUCT.md

These represent a deliberate product-direction shift (sales coach,
not just call analyzer) that the vision doc never reflected. Revenue
milestones/roadmap/design principles untouched — those are
aspirational, not current-state claims.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `README.md`

**Files:** Modify `README.md` (full replacement)

- [ ] **Step 1: Replace the whole file**

Find (current full content):

```
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
```

Replace with:

```markdown
# Salezy

Hebrew B2B sales-call analyzer. Upload a recording, get an AI-generated analysis: customer DISC personality, a quote-anchored salesperson scorecard across 6 categories, a per-stage timeline, a weekly coaching plan, and trend detection across a user's call history.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Supabase — Postgres (RLS on every table), Auth, Storage
- Inngest — background pipeline (transcribe → reason → synthesize → score)
- Transcription: ivrit.ai/whisper-large-v3 + pyannote on Runpod (primary), OpenAI `gpt-4o-transcribe-diarize` (fallback)
- Analysis: Claude Sonnet reasons → GPT-4o formats to JSON (Zod-validated)
- Auth: custom OTP via Resend (not Supabase's built-in email auth)

See `CLAUDE.md` for the full architecture reference, `PRODUCT.md` for product vision, `DESIGN.md` for the visual design system, `docs/OPS.md` for migration/deployment operations.

## Local development

1. Copy the required env vars into `.env.local` (get real values from the project owner — none of these should ever be committed):

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_KEY=
   OPENAI_API_KEY=
   ANTHROPIC_API_KEY=
   RESEND_API_KEY=
   INNGEST_SIGNING_KEY=
   INNGEST_EVENT_KEY=
   RUNPOD_API_KEY=
   RUNPOD_ENDPOINT_ID=
   RUNPOD_BASE_URL=
   TRANSCRIPTION_PROVIDER=
   ```

2. Apply any pending migrations in `supabase/migrations/` (Supabase SQL Editor — see `docs/OPS.md` for the current apply order).

3. Run the dev server and the local Inngest dev server (both configured in `.claude/launch.json`):

   ```bash
   npm run dev
   npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Deployment

GitHub-linked to Vercel — pushing to `main` auto-deploys to production. See `docs/OPS.md` before pushing anything that depends on a new migration.
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\PC\Claude\salezy"
git add README.md
git commit -m "docs: replace create-next-app boilerplate README with a real one

Described the actual product, stack, and local setup (env vars,
dev server + Inngest dev server, migration order) instead of
generic scaffolding text — still referenced the unused Geist font.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## After all 3 tasks

No static gate applies. Report a summary and hand off to `finishing-a-development-branch` as usual. This closes the entire 2026-07-09 audit.
