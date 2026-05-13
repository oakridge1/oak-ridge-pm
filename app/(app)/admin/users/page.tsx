import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserTable } from "./user-table";

export default async function AdminUsersPage() {
  const session = await auth();

  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002D72]">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage team member access and roles.
        </p>
      </div>
      <UserTable users={users} currentUserId={session.user.id} />
    </div>
  );
}
