"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * App-wide toast host (shadcn uses sonner for toasts). Pre-themed to the Salezy
 * dark system — surface background, hairline border, brand text — and RTL so
 * Hebrew toasts read correctly. Mounted once in the root layout; fire toasts
 * from any client component with `toast.error(...)` / `toast.success(...)`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="top-center"
      toastOptions={{
        style: {
          background: "#111118",
          border: "1px solid #2A2A3D",
          color: "#F0F0FF",
          fontFamily: "var(--font-assistant), var(--font-inter), sans-serif",
        },
      }}
    />
  );
}
