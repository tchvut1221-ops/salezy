# Medium/Low audit fixes (items 1-7) — design

## Context

The 2026-07-09 audit's remaining Critical/High items are all closed (file_path ownership, OTP rate limiting, scorecard verbatim quotes, measured talk ratio, ivrit/Runpod cancel-on-stop — all merged and live as of 2026-07-10). Re-verified same day that all 7 Medium/Low code items below are still open (none touched by intervening work). User approved bundling these into one branch, `feature/medium-fixes`, processed in order with a checkpoint after each item rather than a stop-and-ask.

Doc drift (stale CLAUDE.md/PRODUCT.md/README) is deliberately item 8, tackled after these 7 land — different kind of work (writing, not code correctness).

## 1. `retryAnalysis` status guard

**File:** `app/actions.ts:32-54`

Add the same kind of guard its siblings already have (`cancelAnalysis` checks `RUNNING_STATUSES`, `resumeAnalysis` checks `=== "cancelled"`) — `retryAnalysis` currently has none, so it can reset *any* status back to `"uploaded"` and re-dispatch the paid pipeline. Guard: only allow from `"failed"` or `"no_speech_detected"`.

## 2. Error-message sanitization

**File:** `lib/inngest/functions.ts:187-198` (the `onFailure` handler)

Currently stores the raw upstream message (`failure.data.error?.message`) directly in `analyses.error`, which ships to the owning client via `select("*")`. Fix at the source: `console.error` the raw message server-side, store a generic Hebrew message in the row instead. One handler, fixes every read site at once — no need to touch `app/analysis/[id]/page.tsx`.

## 3. Security headers

**File:** `next.config.ts`

Add `async headers()`. Verified what this app actually needs before writing the policy:
- Fonts are self-hosted via `next/font/google` (build-time download) — no external font origin needed in the CSP.
- `connect-src` needs the Supabase project origin in **both** `https://` (REST/Auth/Storage) and `wss://` (Realtime, used for live analysis status updates) forms.
- `script-src`/`style-src` need `'unsafe-inline'` — Next's hydration bootstrap and Tailwind's inline styles need it; a nonce-based CSP would need per-request nonce generation in `proxy.ts` (this repo's middleware), which is a materially bigger, separate change not justified for a Low-severity baseline-hardening item.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://gsfuzqoitldvudkeezwt.supabase.co wss://gsfuzqoitldvudkeezwt.supabase.co;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**This is the one item in this batch verified live in a browser** (dev server + check console for CSP violations) rather than only statically — a wrong policy silently breaks real functionality (auth, uploads, realtime), unlike the other six backend-only items.

## 4. Upload MIME/size hardening

**File:** new migration `supabase/migrations/0014_harden_recordings_bucket.sql`

Sets `allowed_mime_types`/`file_size_limit` directly on the `recordings` bucket, mirroring `lib/constants.ts`'s `ALLOWED_MIME_TYPES` exactly and `MAX_FILE_BYTES` (50MB). Closes the "client-only enforcement" gap at the storage layer itself, defense-in-depth alongside the existing client check.

## 5. Missing `loading.tsx`/`error.tsx`

**Files:** `app/analysis/[id]/loading.tsx`, `app/analysis/[id]/error.tsx`, `app/upload/loading.tsx`, `app/upload/error.tsx` (new)

Follow the existing pattern from `app/dashboard/loading.tsx`/`app/patterns/loading.tsx` (skeleton matching real layout). `error.tsx` files are new to this repo (none exist yet anywhere) — minimal Next.js error boundary convention: client component, `error`+`reset` props, Hebrew retry copy matching this app's existing tone.

## 6. DISC ensemble pass-count bias

**Files:** `lib/disc.ts` (`ensembleDetectSigns`, `computeCustomerPersonality`)

`ensembleDetectSigns` returns pooled signs but not how many passes actually survived `Promise.allSettled`; `computeCustomerPersonality` then divides density by the *requested* count (`getDiscEnsemblePasses()`) instead of the *successful* one, understating density whenever any pass fails. Fix: `ensembleDetectSigns` returns `{ signs: RawDiscSigns; successfulPasses: number }`; `computeCustomerPersonality` passes `successfulPasses` (not `passes`) into `computeDiscResult`. `computeDiscResult`'s own signature (`raw, passes`) is unchanged — only what gets passed as its second argument changes.

## 7. Patterns chart color

**File:** `components/salezy/patterns-view.tsx:42`

`fill="#4D7EFF"` (accent-blue) → `fill="#00D4A0"` (the literal value of `--score-high`, per `DESIGN.md:45`). Raw hex, not a `var()` reference — matches this exact file's own existing convention (every other color in it, e.g. `stroke="#2A2A3D"`, is already a raw hex literal, not a CSS var).

## Verification plan

Items 1, 2, 4, 6, 7: static gate only (tsc/lint/build) — same bar as today's earlier backend-only fixes, no test framework in this repo.
Item 3: static gate **plus** live browser check (dev server, `preview_console_logs` for CSP violations, exercise login/upload/dashboard to confirm nothing is silently blocked).
Item 5: static gate plus a quick visual check that the new loading/error states render (can trigger via dev server, e.g. throwing in the page briefly is unnecessary — visually confirming the skeleton/error boundary files themselves are correct Next.js conventions is sufficient given no test framework).

## Out of scope

Item 8 (doc drift) — separate, after these land. Everything else from the 2026-07-09 audit not on this list (already closed or explicitly out of scope per the original audit).
