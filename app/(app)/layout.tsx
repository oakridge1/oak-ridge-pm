import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import type { Role } from "@/app/generated/prisma/client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.active) redirect("/pending");

  return (
    <div className="min-h-full flex flex-col">
      <Header
        userName={session.user.name}
        userRole={session.user.role as Role}
        userImage={session.user.image}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
