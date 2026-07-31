import type { NextConfig } from "next";

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

  // Content-Security-Policy is deliberately NOT set here — it needs a
  // per-request nonce (see lib/csp.ts + proxy.ts), which this static config
  // can't generate. proxy.ts's applySecurityHeaders sets it (and these same
  // five headers again, redundant-but-harmless) on every response it
  // touches; these five stay here as the backstop for paths proxy.ts's
  // matcher excludes (static assets, images).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
