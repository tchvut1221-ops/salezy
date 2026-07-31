import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

/**
 * 192x192 PWA icon for manifest.ts (purpose "any"). Same brand mark as
 * apple-icon.tsx, scaled to this size — Satori/ImageResponse needs its own
 * inline-JSX tree per route (no Tailwind classes, no reusing components/
 * salezy/logo.tsx directly), so the markup is duplicated rather than shared,
 * matching apple-icon.tsx's existing precedent for the same reason.
 *
 * A plain Route Handler (GET), not the icon.tsx/apple-icon.tsx special-file
 * convention — that convention only recognizes those exact filenames (plus
 * numbered icon1.tsx/icon2.tsx variants) for auto-injected <head> favicon
 * links, not for arbitrary custom sizes referenced by manifest.ts.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0f",
        }}
      >
        <svg width={118} height={118} viewBox="0 0 64 64" fill="none">
          <g stroke="#4d7eff" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M32 6 L54 19 L54 45 L32 58 L10 45 L10 19 Z"
              strokeWidth={2.5}
              opacity={0.85}
            />
            <path d="M13 33 L21 27" strokeWidth={2.5} opacity={0.7} />
            <path d="M13 39 L19 34.5" strokeWidth={2.5} opacity={0.7} />
            <path d="M22 46 H40 V32 H24 V22 L48 10" strokeWidth={4} />
            <path d="M48 10 L40 10 M48 10 L48 18" strokeWidth={4} />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
