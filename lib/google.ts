import { prisma } from "@/lib/prisma";

export const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
];

export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
];

export const ALL_GOOGLE_SCOPES = [
  "email",
  "profile",
  ...SHEETS_SCOPES,
  ...CALENDAR_SCOPES,
];

export async function getGoogleConnection() {
  return prisma.googleConnection.findFirst();
}

export async function getValidAccessToken(): Promise<string | null> {
  const conn = await getGoogleConnection();
  if (!conn) return null;

  const now = new Date();
  const bufferMs = 60 * 1000; // refresh 1 minute before expiry

  if (conn.accessToken && conn.tokenExpiry && conn.tokenExpiry.getTime() - bufferMs > now.getTime()) {
    return conn.accessToken;
  }

  // Refresh the access token
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("[google] token refresh failed:", await res.text());
    return null;
  }

  const data = await res.json() as {
    access_token: string;
    expires_in: number;
  };

  const expiry = new Date(Date.now() + data.expires_in * 1000);

  await prisma.googleConnection.update({
    where: { id: conn.id },
    data: {
      accessToken: data.access_token,
      tokenExpiry: expiry,
    },
  });

  return data.access_token;
}

export async function googleFetch(
  url: string,
  init: RequestInit = {},
  accessToken: string,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

export function getGoogleOAuthUrl(baseUrl: string): string {
  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) throw new Error("AUTH_GOOGLE_ID is not set");

  const redirectUri = `${baseUrl}/api/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ALL_GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
