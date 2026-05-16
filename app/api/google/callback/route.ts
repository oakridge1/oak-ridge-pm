export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ALL_GOOGLE_SCOPES } from "@/lib/google";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/admin/settings?error=google_denied`);
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}/admin/settings?error=config_missing`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${baseUrl}/api/google/callback`,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[google/callback] token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${baseUrl}/admin/settings?error=token_exchange`);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  if (!tokens.refresh_token) {
    console.error("[google/callback] no refresh_token returned");
    return NextResponse.redirect(`${baseUrl}/admin/settings?error=no_refresh_token`);
  }

  // Get user email
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    console.error("[google/callback] userinfo failed:", await userRes.text());
    return NextResponse.redirect(`${baseUrl}/admin/settings?error=userinfo`);
  }

  const userInfo = await userRes.json() as { email: string };
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  // Upsert: delete all old connections, create new one
  await prisma.googleConnection.deleteMany();
  await prisma.googleConnection.create({
    data: {
      email: userInfo.email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      tokenExpiry,
      scopes: ALL_GOOGLE_SCOPES.join(" "),
      connectedById: session.user.id,
    },
  });

  return NextResponse.redirect(`${baseUrl}/admin/settings?connected=1`);
}
