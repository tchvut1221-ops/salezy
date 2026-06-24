"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It replaces
 * the whole document, so it can't rely on the layout's fonts/CSS — colors are
 * inlined from the brand tokens (bg #0A0A0F, text #F0F0FF, accent #4D7EFF).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0F",
          color: "#F0F0FF",
          fontFamily: "system-ui, sans-serif",
          padding: "1rem",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
            border: "1px solid #2A2A3D",
            background: "#111118",
            borderRadius: "12px",
            padding: "2rem",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            משהו השתבש
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#8888AA",
            }}
          >
            נתקלנו בתקלה בלתי צפויה. נסו לרענן את הדף.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              border: "none",
              borderRadius: "8px",
              background: "#4D7EFF",
              color: "#F0F0FF",
              fontWeight: 500,
              padding: "0.625rem 1rem",
              cursor: "pointer",
            }}
          >
            נסה שוב
          </button>
        </div>
      </body>
    </html>
  );
}
