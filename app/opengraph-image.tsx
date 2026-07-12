import { ImageResponse } from "next/og";

export const alt = "Salezy — ניתוח שיחות מכירה מבוסס בינה מלאכותית";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic OG card via Satori (next/og). Brand wordmark + monogram only — no
 * Hebrew glyphs. Satori needs an explicit Hebrew-capable font binary to
 * render Hebrew text at all (its default fallback font is Latin-only), and
 * fetching/bundling one is a separate, riskier piece of work; the wordmark
 * "Salezy" is already the Latin brand name used as the site title everywhere,
 * so a logo-forward card needs no Hebrew text to be recognizable and correct.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          backgroundColor: "#0a0a0f",
        }}
      >
        <svg width={140} height={140} viewBox="0 0 64 64" fill="none">
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
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, color: "#f0f0ff" }}>
          Salezy
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#8888aa" }}>
          AI Sales Call Analysis
        </div>
      </div>
    ),
    { ...size }
  );
}
