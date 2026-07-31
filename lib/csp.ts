const SUPABASE_ORIGIN = "https://gsfuzqoitldvudkeezwt.supabase.co";
const SUPABASE_WS_ORIGIN = "wss://gsfuzqoitldvudkeezwt.supabase.co";

/**
 * Builds a nonce-scoped CSP for a single request. `script-src` carries the
 * per-request nonce with no `'unsafe-inline'` — the actual XSS-hardening
 * change: a user who uploads a recording of a real client call is trusting
 * this app with their data, and `unsafe-inline` was the one gap that made a
 * successful injection actually exploitable.
 *
 * `style-src` deliberately keeps `'unsafe-inline'`. CSP drops
 * `'unsafe-inline'` the instant a nonce is present in the same directive, so
 * a nonce'd style-src isn't achievable without: rewriting `sonner`, which
 * injects a `<style>` tag at runtime with zero nonce support
 * (node_modules/sonner/dist/index.mjs); rewriting lib/export-pdf.ts's
 * `onclone` `<style>` injection into html2canvas's cloned document; and
 * losing every `style={{...}}` attribute Recharts and this app's own
 * dynamic-width components (scorecard talk-ratio bar, personality sliders,
 * dashboard stagger delays) rely on. That's real follow-up work, not
 * something to silently drop here.
 *
 * Fonts are self-hosted via next/font/google (no external font origin
 * needed).
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // React dev mode needs eval() for its debugging features (it logs a CSP
    // error on every page without it); production React never uses eval, so
    // the allowance is dev-only.
    `script-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS_ORIGIN}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Dev runs over plain-http localhost, where upgrading same-origin
    // subresources to https would just break them.
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Applied to EVERY response the middleware produces, including early
 * returns (the /login redirect) — a middleware-generated redirect does not
 * pick up next.config.ts's headers() the way a normally-rendered page does,
 * so without this the redirect would ship with no CSP, no HSTS, no
 * nosniff/X-Frame-Options at all. The other five headers are also declared
 * in next.config.ts as a backstop for paths this middleware's matcher
 * excludes (static assets) — setting them here too is redundant-but-harmless
 * for paths that go through both (`.headers.set` overwrites, never
 * duplicates).
 */
export function applySecurityHeaders<T extends Response>(response: T, csp: string): T {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}
