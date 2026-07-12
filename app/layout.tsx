import type { Metadata, Viewport } from "next";
import { Inter, Assistant, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/salezy/site-header";
import { Toaster } from "@/components/salezy/toaster";

// Inter carries Latin text and the wordmark. It has no Hebrew glyphs, so Hebrew
// falls through (per-glyph) to Assistant — a clean Hebrew sans that sits well
// next to Inter. JetBrains Mono is reserved for every numeral (scores, %, dates).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

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
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
