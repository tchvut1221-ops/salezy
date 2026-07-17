import type { Metadata } from "next";

// The login page itself is a client component ("use client", for form
// state), so it can't export `metadata` directly — this passthrough server
// layout carries the unique document title instead (WCAG 2.4.2).
export const metadata: Metadata = { title: "התחברות" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
