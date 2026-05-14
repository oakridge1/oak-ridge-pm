import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        try {
          // Query by id (more reliable than email across adapters)
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, role: true, active: true },
          });
          if (!dbUser) {
            console.warn(`[auth] session callback: no DB user found for id=${user.id} email=${user.email}`);
          }
          session.user.id = user.id;
          session.user.role = (dbUser?.role ?? "FIELD") as Role;
          session.user.active = dbUser?.active ?? false;
          console.log(`[auth] session ok: id=${user.id} email=${user.email} active=${session.user.active} role=${session.user.role}`);
        } catch (err) {
          console.error("[auth] session callback DB error:", err);
          session.user.id = user.id;
          session.user.role = "FIELD" as Role;
          session.user.active = false;
        }
      }
      return session;
    },
    async signIn({ user, account }) {
      console.log(`[auth] signIn: provider=${account?.provider} email=${user.email} id=${user.id}`);
      return true;
    },
  },
});