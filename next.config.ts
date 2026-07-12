import type { NextConfig } from "next";

const SUPABASE_ORIGIN = "https://gsfuzqoitldvudkeezwt.supabase.co";
const SUPABASE_WS_ORIGIN = "wss://gsfuzqoitldvudkeezwt.supabase.co";

// Baseline security headers. script-src/style-src need 'unsafe-inline' for
// Next's hydration bootstrap and Tailwind's inline styles — a nonce-based CSP
// would need per-request nonce generation in proxy.ts, a materially bigger
// change not justified for this baseline-hardening pass. Fonts are
// self-hosted via next/font/google (no external font origin needed).
const CSP = [
  "default-src 'self'",
  // React dev mode needs eval() for its debugging features (it logs a CSP
  // error on every page without it); production React never uses eval, so
  // the allowance is dev-only.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
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

const nextConfig: NextConfig = {
  // Keep ffmpeg-static out of the webpack bundle. When it's bundled, its
  // `__dirname` is rewritten and the exported binary path resolves to a
  // non-existent location (`/ROOT/.../ffmpeg`), causing `spawn ... ENOENT`.
  // As an external package it stays in node_modules and the path resolves
  // correctly at runtime.
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],

  // The binary itself is spawned by path (not imported), so file tracing
  // doesn't include it automatically — force it into the Inngest function bundle.
  outputFileTracingIncludes: {
    "/api/inngest": ["./node_modules/ffmpeg-static/**"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
