# Doc drift fixes (item 8) — design

## Context

Last remaining item from the 2026-07-09 audit (everything else — all Critical/High/Medium/Low code items — is merged and live as of today). Pure fact-correction, not a design decision: the "right" content is simply what the shipped code actually does. Verified current state of all three files directly before writing this (see chat) — `CLAUDE.md`'s transcription section turned out already accurate (updated by the ivrit branch's own commits when merged today), narrowing the real scope.

## `CLAUDE.md`

1. Line 12 `Auth: Magic Link via Supabase Auth` → replace with the real flow: custom 8-digit OTP generated server-side, emailed via Resend, redeemed for a real Supabase session (`app/api/auth/send-otp`, `verify-otp`).
2. "Current MVP Scope" (lines 36-41) gets a new item covering what's shipped since: Scorecard (6 quote-anchored categories + measured talk ratio), Stage Analysis timeline, Coaching Plan, Patterns page (3+ scored-call gate), DISC calibration engine (quantitative word-pair method, not LLM-holistic).
3. "What NOT to build yet" (line 44) drops "PDF export" — a print-CSS-based PDF button already exists (`analysis-view.tsx`).

## `PRODUCT.md`

Add a new numbered item to the "Analysis" section (after the existing 1-10) covering Scorecard/Stage Analysis/Coaching Plan/Patterns as a coherent "sales coach, not just call analyzer" capability — this was a deliberate product-direction shift (per project memory) that the doc never reflected. Leave Revenue Milestones/Roadmap/Design Principles untouched — those are aspirational vision statements, not current-state claims, so they're not "wrong."

## `README.md`

Full replacement. New structure: one-paragraph description (Hebrew B2B sales-call analyzer), stack summary (mirrors CLAUDE.md's Stack section, condensed), local dev setup (env vars needed — names only, no values — `npm run dev` + the Inngest dev server from `.claude/launch.json`), links to `CLAUDE.md`/`PRODUCT.md`/`DESIGN.md`/`docs/OPS.md` for detail. Drops all create-next-app boilerplate (Geist font reference, generic Next.js links).

## Verification

No static gate applies (markdown only, not compiled). Verification is a read-through confirming every specific factual claim matches the actual current code (auth flow, feature list, env var names, dev commands) — cross-checked against files already read today, not re-derived from memory.
