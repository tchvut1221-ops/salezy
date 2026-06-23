import type { Metadata } from "next";
import { Inter, Assistant, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/salezy/site-header";

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

export const metadata: Metadata = {
  title: "Salezy — ניתוח שיחות מכירה",
  description: "העלה הקלטת שיחת מכירה וקבל תמלול וניתוח פסיכולוגי מבוסס AI.",
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
      </body>
    </html>
  );
}
