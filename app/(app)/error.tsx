"use client"; // Error boundaries must be Client Components

import { ErrorScreen } from "@/components/error-screen";

// Catches errors in signed-in pages. Per the Next.js docs this boundary wraps
// the pages below app/(app)/layout.tsx, so the header stays on screen.
export default function AppError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void; // re-fetches and re-renders (Next 16.2+)
  reset?: () => void;          // re-renders without re-fetching
}) {
  return <ErrorScreen error={error} onRetry={() => (unstable_retry ?? reset)?.()} />;
}
