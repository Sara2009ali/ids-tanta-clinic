"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for failures in the root layout itself (where even
 * ThemeProvider/Toaster may not have mounted) — must render its own
 * <html>/<body> and can't assume any app-level provider is available, so
 * this stays deliberately minimal and self-contained rather than reusing
 * the themed ui/* components every other error.tsx uses.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Root layout failed to render", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            padding: "1.5rem",
            textAlign: "center",
            color: "#2a251f",
            backgroundColor: "#fafaf8",
          }}
        >
          <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Something went wrong.</p>
          <p style={{ fontSize: "0.875rem", color: "#79726b", margin: 0 }}>
            The application couldn&apos;t load. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#fafaf8",
              backgroundColor: "#1e5c46",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
