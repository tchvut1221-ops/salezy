import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The ffmpeg-static binary is spawned by path (not imported), so Next.js's
  // file tracer doesn't bundle it into the serverless function by default —
  // causing `spawn .../ffmpeg ENOENT` on Vercel. Force-include it in the
  // Inngest route's bundle (that's where the audio pipeline runs).
  outputFileTracingIncludes: {
    "/api/inngest": ["./node_modules/ffmpeg-static/**"],
  },
};

export default nextConfig;
