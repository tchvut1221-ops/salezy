# Salezy — Product Vision

## What is it
A web app that analyzes sales call recordings using AI.
Salesperson uploads a recording → gets transcription + psychological analysis.

## Target User
Individual salespeople in Israel. Not enterprises.
Price: 200 NIS/month subscription.

## Analysis
**Core (every analysis):**
1. Customer personality — Analytical / Driver / Amiable / Expressive
2. Salesperson performance — what worked, what didn't, actionable tips
3. Customer needs — explicit and implicit signals from the call

**Enriched (when the AI has enough signal in the call):**
4. Executive summary + call objective (achieved / partial / not achieved)
5. Overall score (0-100) + sub-scores: needs discovery, objection handling, listening ratio, closing
6. Deal stage (discovery / demo / objection / negotiation / close)
7. Buying signals, competitors mentioned, objection-by-objection handling quality
8. Key moments (buying signals / objections / pain points / breakthroughs) with quotes
9. Prioritized next steps (urgent / soon / when possible) with reasoning
10. Dashboard trend — score-per-call chart + aggregate stats (call count, average score, improvement, dominant personality type) across all of a user's analyses
11. Salesperson Scorecard + coaching — a deliberate shift from "call analyzer" to "sales coach": 6 quote-anchored categories (opening/discovery/pitch/objection handling/closing/talk ratio) grading the SALESPERSON (not just profiling the customer), a weekly coaching plan, a per-call Stage Analysis timeline (sentiment + failure point per stage), and a Patterns page surfacing recurring trends once a user has 3+ scored calls. Customer-personality classification (item 1) now runs on a dedicated quantitative DISC engine (word-pair method) rather than being inferred holistically by the LLM.

## Revenue Milestones
- Stage 1: 3,000 NIS/month (15 paying users)
- Stage 2: 10,000 NIS/month (50 users)
- Stage 3: 20,000 NIS/month (100 users)

## Roadmap
Phase 1 (MVP): File upload + analysis + landing page + dashboard analytics — done
Phase 2: Real-time recording on mobile
Phase 3: Zoom/Meet integration
Phase 4: Teams

## Design Principles
- 70% functionality, 30% design
- Clean, modern, not corporate
- Mobile-first
- Dark mode preferred
- Hebrew UI
