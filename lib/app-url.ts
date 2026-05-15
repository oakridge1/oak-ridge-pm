/**
 * Canonical app URL for use in server-side code (emails, notifications, etc.)
 *
 * Resolution order:
 *   1. AUTH_URL         — NextAuth v5 canonical var (set this in Vercel)
 *   2. NEXTAUTH_URL     — Legacy / backward compat
 *   3. VERCEL_URL       — Auto-injected by Vercel (no protocol, e.g. "oak-ridge-pm.vercel.app")
 *   4. localhost:3000   — Local dev fallback
 *
 * Set AUTH_URL=https://oak-ridge-pm.vercel.app in Vercel environment variables.
 */
export const APP_URL: string = (() => {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
})();
