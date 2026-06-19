# Salezy — Claude Code Instructions

## Stack
- Next.js 16.2.9 (App Router, Turbopack) + React 19.2.4 + TypeScript only — no plain JS ever
- Tailwind CSS + shadcn/ui
- Supabase (DB + Storage, RLS on every table)
- Inngest (background jobs)
- Transcription: OpenAI `gpt-4o-transcribe-diarize` (Hebrew, speaker-labeled)
- Analysis (hybrid): Claude Sonnet 4.6 reasons → GPT-4o formats to JSON (Zod-validated). Sales-domain knowledge injected from `lib/sales-knowledge.ts`
- Audio conversion: non-mp3/wav uploads are converted to 16kHz mono mp3 with ffmpeg (inside Inngest)
- Charts: Recharts (dashboard score trend, `components/salezy/score-chart.tsx`)
- Auth: Magic Link via Supabase Auth
- Deployment: Vercel

## Architecture Rules
- Server components by default — client components only when required
- All heavy processing inside Inngest steps, never in API routes
- ffmpeg processing only inside Inngest steps
- API routes must verify the authenticated user on every request

## Security — Non-Negotiable
- SUPABASE_SERVICE_ROLE_KEY: server-side only (API routes / Inngest). Never in client code.
- OPENAI_API_KEY and ANTHROPIC_API_KEY: server-side only (Inngest steps). Never in client bundle.
- All secrets in .env.local — never hardcoded
- RLS enabled on every Supabase table — users access only their own rows
- File uploads: validate type (mp3/wav/m4a/mp4/mov/ogg/aac/webm) and size (max 50MB) before processing
- Never expose stack traces or technical errors to the user
- Rate limit all API routes

## Code Standards
- TypeScript strict mode — no any
- Error handling on every async call
- Loading states on every async action
- User-facing text in Hebrew

## Current MVP Scope
1. Public landing page (`app/page.tsx`) → magic-link login → upload audio file → store in Supabase Storage
2. Inngest pipeline: convert (if needed) → transcribe with `gpt-4o-transcribe-diarize` → reason with Claude Sonnet 4.6 → synthesize to JSON with GPT-4o (Zod-validated against `AnalysisResult`)
3. Analysis output — v1 core (always present): customer personality type / salesperson performance / customer needs. v2 enriched fields (present when the model produces them; UI degrades gracefully if absent): executive summary, overall score + 4 sub-scores, deal stage, buying signals, competitors, objections with handling score, key moments, prioritized next steps, call metrics
4. Display results in `/analysis/[id]` via `components/salezy/analysis-view.tsx` — rotating status messages + skeleton screens while processing, premium v2 cards (or legacy 3-card fallback) on completion
5. Dashboard (`/dashboard`) — stats bar + score-trend chart (`lib/analytics.ts`, `components/salezy/stats-bar.tsx`, `score-chart.tsx`) aggregated from each analysis's flat `scores` snapshot, plus the analysis list

## What NOT to build yet
- Real-time recording, mobile app, Zoom integration, team features, payments, PDF export

## Agents (.claude/commands/)
Invoke agents with `/agent-name [task]` — the Planner routes tasks to the right agent.

| Agent | Purpose |
|-------|---------|
| `/planner`               | Orchestrator — תכנון, ניתוב לסוכנים, skills matrix |
| `/agent-research`        | מחקר טכנולוגי, השוואות שירותים, benchmarks |
| `/agent-security`        | Audit אבטחה, RLS, LLM security, incident response |
| `/agent-pipeline`        | מנוע ה-AI: GPT-4o prompts, schema, Inngest, knowledge base |
| `/agent-design`          | החלטות עיצוביות: specs, visual hierarchy, premium aesthetic |
| `/agent-ui`              | React components, pages, UX flows |
| `/agent-analytics`       | Dashboard stats, Supabase aggregation queries, charts |
| `/agent-data`            | lib/sales-knowledge.ts, docs/, עדכון CLAUDE.md |

**Custom Skills:**
| `/prompt-upgrade`         | שדרוג פרומפט GPT מתודי עם 3 שיחות מבחן |
| `/analysis-quality-check` | בדיקת איכות ניתוח לפני deploy (18-point checklist) |
| `/knowledge-update`       | הוספת ידע מכירות ל-sales-knowledge.ts |
