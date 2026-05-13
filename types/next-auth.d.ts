import type { Role } from "@/app/generated/prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      active: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
