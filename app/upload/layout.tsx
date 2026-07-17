import type { Metadata } from "next";

// UploadPage is a client component ("use client", for upload state), so it
// can't export `metadata` directly — this passthrough server layout carries
// the unique document title instead (WCAG 2.4.2).
export const metadata: Metadata = { title: "העלאת שיחה" };

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
