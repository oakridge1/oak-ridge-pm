"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Last-resort boundary for failures in the root layout. Per the Next.js docs it
// replaces the root layout while active, so it must define its own <html> and
// <body> and can't rely on the app's CSS (globals.css loads in the root layout).
// Plain inline styles and no imports keep it from failing itself.
export default function GlobalError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void; // re-fetches and re-renders (Next 16.2+)
  reset?: () => void;          // re-renders without re-fetching
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = () => (unstable_retry ?? reset)?.();

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#f8f9fa",
          color: "#1a1a1a",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <title>Something went wrong</title>
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#9ca3af",
            }}
          >
            Oak Ridge Electrical
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, color: "#1e3a8a" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "#4b5563" }}>
            The app ran into a problem. Please try again. If it keeps happening,
            let the office know and give them the code below.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              onClick={retry}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#1e3a8a",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                color: "#374151",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Go to dashboard
            </a>
          </div>

          <a
            href="/api/auth/signout"
            style={{ fontSize: 12, color: "#6b7280", textDecoration: "underline" }}
          >
            Sign out
          </a>

          {error.digest && (
            <p style={{ margin: "16px 0 0", fontSize: 11, color: "#9ca3af" }}>
              Error code: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
