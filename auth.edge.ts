// Edge-compatible auth check used in proxy.ts.
// Database sessions can't be verified at the edge, so we just check
// if the session cookie is present. Full session data is read in
// server components via auth.ts.
import { NextRequest } from "next/server";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

export function getSessionCookie(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value;
}
