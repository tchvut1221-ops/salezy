# Salezy — Claude Code Instructions

## Stack
- Next.js 14 (App Router) + TypeScript only — no plain JS ever
- Tailwind CSS + shadcn/ui
- Supabase (DB + Storage)
- Inngest (background jobs)
- OpenAI Whisper (transcription) + GPT-4o (analysis)
- Auth: Magic Link via Supabase Auth
- Deployment: Vercel

## Architecture Rules
- Server components by default — client components only when required
- All heavy processing inside Inngest steps, never in API routes
- ffmpeg processing only inside Inngest steps
- API routes must verify the authenticated user on every request

## Security — Non-Negotiable
- SUPABASE_SERVICE_ROLE_KEY: server-side only (API routes / Inngest). Never in client code.
- All secrets in .env.local — never hardcoded
- RLS enabled on every Supabase table — users access only their own rows
- File uploads: validate type (mp3/wav/m4a only) and size (max 100MB) before processing
- Never expose stack traces or technical errors to the user
- Rate limit all API routes

## Code Standards
- TypeScript strict mode — no any
- Error handling on every async call
- Loading states on every async action
- User-facing text in Hebrew

## Current MVP Scope
1. Upload audio file → store in Supabase Storage
2. Inngest job: transcribe with Whisper → analyze with GPT-4o
3. Analysis output: customer personality type / salesperson performance / customer needs
4. Display results in /analysis/[id]

## What NOT to build yet
- Real-time recording, mobile app, Zoom integration, team features, payments

## Agents (.claude/commands/)
Invoke agents with `/agent-name [task]` — the Planner routes tasks to the right agent.

| Agent | Purpose |
|-------|---------|
| `/planner` | Orchestrator — תכנון, ניתוב לסוכנים, skills matrix |
| `/agent-research` | מחקר טכנולוגי, השוואות שירותים, benchmarks — מייצר docs/research/ |
| `/agent-security` | Audit אבטחה, RLS, LLM security, incident response |

**Skills Matrix** (מה להריץ אחרי כל סוכן):
- research → `/code-review low`
- security → `/owasp-security` → `/security-review` → `/code-review ultra` → `/verify` → `/canary`
