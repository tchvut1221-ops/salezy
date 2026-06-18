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
};

export default nextConfig;
