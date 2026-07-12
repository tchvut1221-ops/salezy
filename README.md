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
