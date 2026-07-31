import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applySecurityHeaders } from "@/lib/csp";

const PROTECTED_PREFIXES = ["/dashboard", "/upload", "/analysis", "/patterns"];

/**
 * Refreshes the Supabase auth session on every request and guards protected
 * routes. Unauthenticated users hitting a protected route are sent to /login.
 *
 * `requestHeaders` (carrying this request's CSP nonce, set by proxy.ts) is
 * threaded through every `NextResponse.next()` call so Next's own hydration
 * bootstrap picks up the nonce; `csp` is applied to every response this
 * function returns via `applySecurityHeaders` (see lib/csp.ts for why the
 * redirect path needs this explicitly).
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
  csp: string
) {
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applySecurityHeaders(NextResponse.redirect(url), csp);
  }

  return applySecurityHeaders(supabaseResponse, csp);
}
