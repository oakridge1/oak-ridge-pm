"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

// Friendly fallback shown by the error boundaries in app/error.tsx and
// app/(app)/error.tsx. Keep it dependency-light so it can't fail itself.
export function ErrorScreen({
  error,
  onRetry,
}: {
  error: Error & { digest?: string };
  onRetry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3">
          Oak Ridge Electrical
        </p>
        <h1 className="text-xl font-bold text-[#1e3a8a] mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-600 mb-5">
          This page ran into a problem. Please try again. If it keeps happening,
          let the office know and give them the code below.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center mb-4">
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white text-sm font-medium hover:bg-[#003d99]"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            Go to dashboard
          </a>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          Sign out
        </button>

        {error.digest && (
          <p className="mt-4 text-[11px] text-gray-400">Error code: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
