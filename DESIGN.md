# Design System

## Brand Identity
Salezy is a precision instrument for Israeli salespeople reviewing their own call performance — the design should feel like opening a cockpit dashboard, not a consumer app. Dark, dense with signal, calm under pressure: the visual language of Linear, Raycast, and the Vercel dashboard, not a SaaS landing-page template.

## What This Design Is NOT
- Not a generic SaaS template with a blue/purple gradient hero and rounded card grids
- Not a "consumer" or pastel product — no soft lavender, no friendly mascot illustrations, no light mode
- Not corporate-enterprise (navy, gray, Arial-on-white, boxy tables) — this is a personal performance tool, not an org chart
- Not busy or over-decorated — every color, badge, and icon must map to a real signal (score, status, urgency). Decoration with no data behind it gets cut.

## Colors
Current implementation already uses Tailwind's emerald/amber/red on a near-black zinc background — this instinct is correct and is being formalized here with exact values, now wired into `globals.css` theme tokens instead of living only as ad-hoc Tailwind utility classes.

- Primary accent: Emerald (#10b981, Tailwind emerald-500) — high scores, success states, primary CTA, active nav
- Secondary / warning: Amber (#f59e0b, Tailwind amber-500) — mid-range scores, "soon" priority, caution states
- Destructive / error: Rose-red (#ef4444, Tailwind red-500) — low scores, missed objections, urgent priority, errors
- Neutrals: zinc scale (NOT gray or slate) — every neutral in the UI is tinted cool-charcoal, never warm gray, never pure black/white
- Background: #09090b (zinc-950)
- Surface (cards, modals, elevated panels): #18181b (zinc-900) with 1px border, no elevation via shadow alone
- Border: rgba(255,255,255,0.10) (hairline, matches existing `.dark { --border: oklch(1 0 0 / 10%) }`)
- Text primary: #fafafa (zinc-50)
- Text secondary: #a1a1aa (zinc-400)
- Destructive/error: #ef4444 (red-500), text-on-dark variant #f87171 (red-400)
- Success: #10b981 (emerald-500), text-on-dark variant #34d399 (emerald-400)
- Warning: #f59e0b (amber-500), text-on-dark variant #fbbf24 (amber-400)

This is a **dark-mode-only** product by deliberate decision, not a dark theme bolted onto a light-first system. Do not build a light mode toggle or light-mode token set — the PRD states dark mode is preferred, and the "precision tool used late at night reviewing your own calls" feeling depends on staying dark-only. The `:root` (light) tokens currently in `globals.css` are dead code left over from the shadcn scaffold and should be removed or left unused; `.dark` is the only theme that ships.

## Typography
**Current gap to fix:** `app/layout.tsx` loads zero fonts via `next/font` — the app is silently falling back to the browser's default system sans-serif. `globals.css` references a `--font-sans` variable that is never defined anywhere. This is the single most "AI-generated-default" thing about the current build and must be fixed before further UI work.

- Hebrew heading font: **Rubik** — geometric, modern, slightly rounded terminals that read as technical/precise rather than corporate. Matches the Linear/Raycast register better than the obvious choice.
- Hebrew body font: **Assistant** — light, airy, excellent legibility at small sizes for dense data tables (objection trackers, key-moment lists, score breakdowns)
- Latin complement: **Geist Mono** (already available via `--font-geist-mono` in the codebase) — for the 0-100 score numbers, percentages, dates, and any English/numeral data. Tabular numerals in a mono face make score deltas and dashboard trend numbers scannable at a glance, which matters a lot for a metrics-first product.
- Platform loading: see `ncode-web-design` skill — load both via `next/font/google` in `app/layout.tsx`, set as CSS variables, and update `--font-sans` in `globals.css` to point at the Rubik/Assistant stack instead of the current undefined reference.
- Scale:
  - Hero / H1: 36px (used sparingly — landing page only)
  - H2 (section headers, "Executive Summary", "Objection Tracker"): 24px
  - H3 (card titles): 18px
  - Body: 16px minimum
  - Caption / small (labels, timestamps, badge text): 13px
  - Score display (gauge center number): 48px in Geist Mono
- Line height: 1.7 for Hebrew body text
- NEVER add letter-spacing to Hebrew text
- Word spacing: 0.05em for Hebrew body readability

## Components
- Border radius: 0.625rem base (already correctly set as `--radius` in `globals.css`) — keep this single value driving the `--radius-sm/md/lg/xl` scale already defined. Do not introduce a second radius value anywhere.
- Shadow approach: no drop shadows for elevation. Elevation is communicated by the zinc-950 → zinc-900 background step plus a 1px hairline border (`oklch(1 0 0 / 10%)`). This matches the existing dark-only system and is more in line with the Linear/Vercel reference than shadow-based depth.
- Buttons: solid emerald fill for primary actions, no gradients, radius-lg, `px-4 py-2` for standard size, hover = brightness lift (emerald-500 → emerald-400) not a shadow or scale transform
- Cards: reserved for genuinely distinct content blocks (Executive Summary, Performance Breakdown, Objection Tracker, Key Moments, Next Steps panel — per the priority hierarchy already defined in `.claude/commands/agent-design.md`). Do not wrap every individual stat or label in its own card — that produces the "card soup" look. Group related stats inside one card with internal dividers instead.
- Inputs: zinc-900 background, hairline border, emerald focus ring (`ring-emerald-500/50`), label positioned above field (never floating-label, which hurts Hebrew RTL alignment)

## Icons
- Library: Lucide
- Weight / strokeWidth: 1.5 (override the 2.0 default everywhere — this is currently not enforced anywhere in the codebase and should be set once via a shared icon wrapper or default prop)
- Usage rule: icons mark signal type (buying signal, objection, pain point, breakthrough, urgency level) for fast scanning down a list — they are never purely decorative. Every icon in a data row sits next to a text label; icon-only buttons are reserved for universally understood actions (close, more-options) and get an `aria-label`.

## RTL Defaults
- `dir="rtl"` already set correctly on `<html>` in `app/layout.tsx` — keep this.
- Use CSS logical properties: `ms` / `me` / `ps` / `pe` instead of `ml` / `mr` / `pl` / `pr` in all new Tailwind classes (audit existing components for hardcoded `ml-`/`mr-` creep as the app grows)
- Arrows and chevrons must mirror for directional meaning — "back" points right, "forward/next step" points left
- Scores, percentages, dates, and call durations: wrap in `<span dir="ltr">` so numerals don't reorder inside Hebrew sentences
- Flex row layouts (e.g. icon + label in Key Moments, badge + score in Objection Tracker) read right-to-left by default — verify icon-then-label order renders correctly, not label-then-icon
