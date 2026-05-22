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
      wage: {
        select: {
          title: true,
          year: true,
          hourlyWage: true,
          burdenRate: true,
          paySchedule: true,
          isFieldCrew: true,
          notes: true,
        },
      },
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

      {/* Admin nav */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4 flex-wrap">
        <a href="/admin/users" className="text-sm font-medium text-[#002D72] border-b-2 border-[#002D72] pb-1 -mb-5">
          Users
        </a>
        <a href="/admin/saved-tasks" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Saved Tasks
        </a>
        <a href="/admin/receipts" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Receipts
        </a>
        <a href="/admin/settings" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Settings
        </a>
      </div>

      <UserTable users={users} currentUserId={session.user.id} />
    </div>
  );
}
