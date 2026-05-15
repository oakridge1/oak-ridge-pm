import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/app-url";
import type { Role } from "@/app/generated/prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      // Allow pre-seeded users (inserted directly into the User table) to sign
      // in via Google OAuth for the first time.  Without this, NextAuth throws
      // OAuthAccountNotLinked when it finds an existing User row with a matching
      // email but no linked Account — causing a silent redirect loop to /login.
      // Safe with Google because Google verifies email ownership.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "database" },
  // Required for Vercel and other reverse-proxy hosts — trusts the
  // X-Forwarded-Host header so OAuth callbacks resolve to the correct URL
  // instead of defaulting to NEXTAUTH_URL (which may be stale/localhost).
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log(`[auth] signIn: provider=${account?.provider} email=${user.email} id=${user.id}`);

      // If Google created a brand-new User (no pre-created record), they get
      // active=false by default (schema default). That's correct — admin must activate.
      // But if an admin pre-created the user, their existing active/role must be preserved.
      // The PrismaAdapter links by email, so the pre-created record is found and reused.
      return true;
    },

    async redirect({ url, baseUrl }) {
      // Use the hard-coded APP_URL as the authority so this callback never
      // depends on NextAuth correctly inferring baseUrl from headers.
      const origin = APP_URL || baseUrl;

      // Allow relative URLs (e.g. callbackUrl="/")
      if (url.startsWith("/")) return `${origin}${url}`;

      // Allow same-origin absolute URLs
      try {
        if (new URL(url).origin === new URL(origin).origin) return url;
      } catch {
        // malformed URL — fall through
      }

      // Cross-origin or stale localhost URL → send to app root.
      // The login page forwards active users to / and inactive users to /pending.
      return origin;
    },

    async session({ session, user }) {
      if (session.user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, role: true, active: true },
          });
          if (!dbUser) {
            console.warn(`[auth] session: no DB user for id=${user.id} email=${user.email}`);
          }
          session.user.id = user.id;
          session.user.role = (dbUser?.role ?? "TEAMMATE") as Role;
          session.user.active = dbUser?.active ?? false;
          console.log(`[auth] session ok: email=${user.email} active=${session.user.active} role=${session.user.role}`);
        } catch (err) {
          console.error("[auth] session callback DB error:", err);
          // Keep user logged in but flag inactive so they land on /pending
          session.user.id = user.id;
          session.user.role = "TEAMMATE" as Role;
          session.user.active = false;
        }
      }
      return session;
    },
  },
});