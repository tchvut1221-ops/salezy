# Design System

> Supersedes the previous version of this file (emerald/zinc/Rubik draft). This is the
> identity actually being implemented in code as of this revision.

## Brand Identity
Salezy is a precision instrument for Israeli salespeople reviewing their own call
performance — not a startup, not a SaaS template. Think Bloomberg Terminal meets modern
B2B: dense, intelligent, intentional. Every screen should feel like the user is inside a
war room, not on a landing page. Carried over from the original product principles: 70%
of the effort is functionality, design is the remaining 30% in service of clarity —
mobile-first, dark mode only, Hebrew-native.

## What This Design Is NOT
- Not a generic SaaS template with a blue/purple gradient hero and rounded card grids
- Not a "consumer" or pastel product — no soft colors, no friendly mascots, no light mode
- Not corporate-enterprise (navy, gray, boxy tables) — this is a personal performance
  tool, not an org chart
- No gradients, no glassmorphism, no generic AI-template look
- Not busy or over-decorated — every color and badge must map to a real signal (score,
  status, urgency, personality type). Decoration with no data behind it gets cut.

## Colors
Dark-mode-only by deliberate decision — there is no light theme.

**Backgrounds**
- `--bg-base: #0A0A0F` — page background
- `--bg-surface: #111118` — cards, panels
- `--bg-elevated: #1A1A26` — nested/elevated surfaces, popovers, track backgrounds
- `--bg-hover: #1F1F2E` — hover state for interactive surfaces

**Structure**
- `--border: #2A2A3D` — default hairline border / divider
- `--border-strong: #3D3D5C` — emphasis border (timeline rail, quote accent)

**Text**
- `--text-primary: #F0F0FF` — headings, primary body, emphasized values
- `--text-secondary: #8888AA` — labels, captions, secondary body text
- `--text-disabled: #444460` — disabled/inactive text

**Accent**
- `--accent-blue: #4D7EFF` — primary CTA, active nav, focus ring, links, info badges

**Score (0-100 scale — gauge, sub-scores, confidence meters, trend chart)**
- `--score-high: #00D4A0` (≥70)
- `--score-mid: #F5A623` (40-69)
- `--score-low: #FF4D6A` (<40)

**Customer DISC personality (Driver / Influence / Steady / Conscientious)**
Locked to the Red/Yellow/Green/Blue "Surrounded by Idiots" mapping already baked into
the analysis prompt (`lib/sales-knowledge.ts`) — the AI's own explanation text names
these colors in Hebrew, so the UI badges must match exactly.
- `--disc-d: #FF4D4D` — Driver ("משימתי") — אדום
- `--disc-i: #FFD400` — Influence/Expressive ("מבטא") — צהוב
- `--disc-s: #00C48C` — Steady/Amiable ("תומך") — ירוק
- `--disc-c: #4D7EFF` — Conscientious/Analytical ("אנליטי") — כחול, shares the accent blue

## Typography
**Why not Inter:** the earlier draft specified Inter for body text. Inter is on this
toolkit's hard reject list (overused AI-default) and is explicitly banned by the
`ncode-anti-vibe-coding` skill. Swapped for a Hebrew-native pairing that fits the
"financial instrument" feeling better.

- Heading font: **Alef** — distinctive, built for financial/data displays, exactly the
  "instrument panel" register this product wants. Used for card titles and section
  headers via the `font-heading` utility.
- Body font: **Heebo** — clean workhorse, excellent number rendering, very legible in
  dense tables (objection tracker, key moments, score breakdowns)
- Numerals/Latin: **JetBrains Mono** — every score, percentage, date, and English string.
  Tabular figures make score deltas and trend numbers scannable at a glance.
- Scale:
  - Hero / H1: 36px (landing page only)
  - H2 (section headers): 24px
  - H3 (card titles): 18px
  - Body: 16px minimum
  - Caption / small (labels, timestamps): 13px
  - Score display (gauge center number): 48px, JetBrains Mono
- Line height: 1.7 for Hebrew body text
- NEVER add letter-spacing to Hebrew text
- Word spacing: 0.05em for Hebrew body readability

## Components
- Border radius: **cards 12px**, **buttons 8px** — two values only, never a third
- Shadow approach: no drop shadows for elevation. Elevation = background step
  (`bg-base` → `bg-surface` → `bg-elevated` → `bg-hover`) plus a 1px `--border` hairline
- Buttons: solid `--accent-blue` fill for primary, no gradients, 8px radius, hover =
  brightness lift not shadow/scale
- Cards: reserved for genuinely distinct content blocks (Executive Summary, Score Gauge,
  Deal Intelligence, Objection Tracker, Key Moments, Next Steps). Group related stats
  inside one card with internal dividers instead of one card per stat ("card soup")
- Inputs: `--bg-elevated` background, `--border` hairline, `--accent-blue` focus ring,
  label above field (never floating-label — breaks Hebrew RTL alignment)
- Charts (Recharts): grid lines `--border`, axis text `--text-secondary`, tooltip
  background `--bg-elevated` with `--border` outline, primary series in `--score-high`,
  secondary/trend series in `--border-strong`

## Icons
- Library: Lucide
- Weight: strokeWidth 1.5 (never the 2.0 default), outline only
- Icons mark signal type (buying signal / objection / pain point / breakthrough /
  urgency) for fast scanning — never purely decorative. Icon + label always paired;
  icon-only is reserved for universally understood actions with an `aria-label`

## RTL Defaults
- `dir="rtl"` on `<html>`, with `dir="ltr"` wrapping any score gauge/chart and any
  numeral, date, or email/URL string
- CSS logical properties only: `ms`/`me`/`ps`/`pe`, never `ml`/`mr`/`pl`/`pr`
- Arrows/chevrons mirror for directional meaning — back points right, forward points left
- Flex rows read right-to-left by default — verify icon-then-label order
