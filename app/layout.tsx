import type { Metadata } from "next";
import { Alef, Heebo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const alef = Alef({
  subsets: ["hebrew"],
  weight: ["400", "700"],
  variable: "--font-alef",
});

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heebo",
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
      className={`dark h-full antialiased ${alef.variable} ${heebo.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
