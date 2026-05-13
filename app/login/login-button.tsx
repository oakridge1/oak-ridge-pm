"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginButton() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <button
      onClick={handleSignIn}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-6 py-3 text-gray-700 font-medium shadow-sm hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {/* Google logo SVG */}
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.4 5.6-5.1 7.3v6h8.2c4.8-4.4 7.2-10.9 7.2-17.4z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8.2-6c-2.1 1.4-4.8 2.2-7.7 2.2-5.9 0-10.9-4-12.7-9.4H2.8v6.2C6.8 42.8 14.9 48 24 48z"
        />
        <path
          fill="#FBBC04"
          d="M11.3 29c-.5-1.4-.7-2.9-.7-4.5s.2-3.1.7-4.5v-6.2H2.8C1 17.6 0 20.7 0 24s1 6.4 2.8 9.2l8.5-6.2z"
        />
        <path
          fill="#EA4335"
          d="M24 9.6c3.3 0 6.3 1.1 8.6 3.4l6.4-6.4C35.9 2.1 30.5 0 24 0 14.9 0 6.8 5.2 2.8 14.8l8.5 6.2C13.1 13.6 18.1 9.6 24 9.6z"
        />
      </svg>
      {loading ? "Signing in…" : "Sign in with Google"}
    </button>
  );
}
