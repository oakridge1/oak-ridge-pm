export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGoogleOAuthUrl } from "@/lib/google";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const oauthUrl = getGoogleOAuthUrl(baseUrl);
  return NextResponse.redirect(oauthUrl);
}
