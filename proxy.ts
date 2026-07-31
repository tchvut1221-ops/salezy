import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/csp";

/**
 * The CSP (and therefore the nonce) must be built here and set on the
 * REQUEST headers, not only the response. Next.js's own nonce-propagation
 * mechanism — the one that attaches a nonce to its internally-generated
 * inline scripts (the hydration bootstrap, the RSC flight payload) — reads
 * the nonce by parsing the *request's* `Content-Security-Policy` header, not
 * any custom header. Confirmed against the installed Next 16.2.9 source
 * (node_modules/next/dist/server/app-render/app-render.js:167-168 — `const
 * csp = headers['content-security-policy'] || ...; const nonce =
 * getScriptNonceFromHeader(csp)`). Setting the CSP only on the response
 * (this file's previous behavior) means Next always computes
 * `nonce = undefined` internally, so its own inline scripts render with no
 * `nonce` attribute at all — silently blocked by `script-src 'nonce-...'`
 * with no `unsafe-inline`, so React never hydrates, site-wide. This is
 * invisible to curl and to `next build`, since CSP is only ever enforced
 * client-side.
 */
export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return await updateSession(request, requestHeaders, csp);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
