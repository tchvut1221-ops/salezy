import type { Metadata, Viewport } from "next";
import { Inter, Assistant, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/salezy/site-header";
import { SiteFooter } from "@/components/salezy/site-footer";
import { AccessibilityWidget } from "@/components/salezy/accessibility-widget";
import { Toaster } from "@/components/salezy/toaster";

// Inter carries Latin text and the wordmark. It has no Hebrew glyphs, so Hebrew
// falls through (per-glyph) to Assistant — a clean Hebrew sans that sits well
// next to Inter. JetBrains Mono is reserved for every numeral (scores, %, dates).
//
// adjustFontFallback:false is kept for intent (and in case Vercel ships a fix),
// but it does NOT currently work: next/font/google unconditionally injects a
// synthetic "Inter Fallback" face (local Arial, unicode-range U+0-10FFFF — full
// coverage, including Hebrew) into the `.variable` CSS variable regardless of
// this option. That's a confirmed upstream regression, not a config mistake —
// see https://github.com/vercel/next.js/issues/73838. Since that fallback face
// sits before Assistant in --font-sans, the browser was never actually reaching
// Assistant: every Hebrew glyph on the site rendered in Arial.
//
// The actual fix: read Inter's own resolved font-family off inter.style
// (Next.js exposes this as a plain string at build/render time, e.g.
// `Inter, "Inter Fallback"`) and keep only the first name — "Inter" itself,
// dropping the broken synthetic fallback — then feed *that* into --font-sans
// via a dedicated custom property (--font-inter-primary, set inline below)
// instead of the framework's own --font-inter variable.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  adjustFontFallback: false,
});
const interPrimaryFamily = inter.style.fontFamily.split(",")[0];

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-assistant",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
});

const SITE_URL = "https://salezy.vercel.app";
const TITLE = "Salezy — ניתוח שיחות מכירה";
const DESCRIPTION = "העלה הקלטת שיחת מכירה וקבל תמלול וניתוח פסיכולוגי מבוסס AI.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s — Salezy" },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Salezy",
    locale: "he_IL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`dark h-full antialiased ${inter.variable} ${assistant.variable} ${jetbrainsMono.variable}`}
      style={{ "--font-inter-primary": interPrimaryFamily } as React.CSSProperties}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent-blue-deep focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          דלג לתוכן
        </a>
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
        <AccessibilityWidget />
        <Toaster />
      </body>
    </html>
  );
}
