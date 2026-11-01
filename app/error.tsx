"use client"; // Error boundaries must be Client Components

import { ErrorScreen } from "@/components/error-screen";

// Catches errors elsewhere under the root, including a failure in
// app/(app)/layout.tsx (a boundary can't catch errors in its own segment's
// layout, so the parent boundary handles it). Root layout errors are handled
// by app/global-error.tsx.
export default function RootError({
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
