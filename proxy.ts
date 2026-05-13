import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "@/auth.edge";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  // Always allow public paths
  const publicPaths = ["/login", "/api/auth", "/_next", "/favicon", "/logo"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  // Allow static file extensions
  if (/\.\w+$/.test(pathname)) return NextResponse.next();

  // Not signed in → login
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Role-based guard is handled in each server component/layout via auth()
  // The proxy only enforces "must be signed in" at the edge
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
