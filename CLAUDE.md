# Salezy — Claude Code Instructions

## What is Salezy
A web app that analyzes sales call recordings using AI.
The user uploads an audio file → gets transcription + psychological analysis of the conversation.

## Target User
Individual salespeople in Israel. Not enterprises.
They pay 200 NIS/month for a subscription.

## MVP Scope (Week 1-2)
1. Upload audio file (mp3/wav/m4a)
2. Transcribe using Whisper API
3. Analyze the transcript using GPT-4 / Claude
4. Display structured analysis report

## Analysis Output (3 Focus Areas)
1. Customer personality type — Analytical / Driver / Amiable / Expressive
2. Salesperson performance — what worked, what didn't, actionable tips
3. Customer needs — what the customer actually wants (explicit + implicit)

## Tech Stack
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Auth: Clerk or NextAuth
- DB: Supabase (PostgreSQL)
- File Storage: Supabase Storage
- Transcription: OpenAI Whisper API
- Analysis: OpenAI GPT-4o
- Payments: Stripe (future)
- Deployment: Vercel

## Project Structure
salezy/
├── app/
│   ├── (auth)/
│   ├── dashboard/
│   ├── upload/
│   ├── analysis/[id]/
│   └── api/
├── components/
│   ├── ui/
│   └── salezy/
├── lib/
│   ├── whisper.ts
│   ├── analysis.ts
│   └── supabase.ts
└── types/
    └── index.ts

## Design Principles
- 70% functionality, 30% design
- Clean, professional, modern — not corporate
- Hebrew primary language for UI text
- Mobile-first
- Dark mode preferred

## Key Rules
- Always use TypeScript, never plain JS
- Use server components by default
- All API keys in .env.local, never hardcoded
- Error handling on every API call
- Loading states on every async action

## Current Status
MVP Phase — building core upload + analysis flow.
Auth and payments come after core works.

## What NOT to build yet
- Real-time recording (Phase 2)
- Mobile app (Phase 2)
- Zoom/Meet integration (Phase 3)
- Multi-user teams (future)
- Dashboard analytics (after 50 users)
