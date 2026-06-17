import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
