import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * 512x512 PWA icon for manifest.ts (purpose "maskable"). Same brand mark as
 * apple-icon.tsx/icon-192, but the glyph is sized smaller relative to the
 * canvas (~55%) and the background fills the entire square edge-to-edge —
 * maskable icons get cropped to arbitrary OS shapes (circle, squircle,
 * rounded square), so content must sit inside the ~80% "safe zone" or it
 * gets clipped.
 *
 * A plain Route Handler (GET) — see icon-192/route.tsx for why this isn't
 * the icon.tsx/apple-icon.tsx special-file convention.
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
        <svg width={282} height={282} viewBox="0 0 64 64" fill="none">
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
