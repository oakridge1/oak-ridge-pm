import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { notificationPreferences: true },
  });

  if (!user) redirect("/login");

  const canEditNotifications = await hasPermission(user.id, user.role, "NOTIFICATION_SETTINGS");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a8a]">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your display name and notification preferences.
        </p>
      </div>

      <ProfileClient
        user={{
          id:    user.id,
          name:  user.name ?? "",
          email: user.email ?? "",
          role:  user.role,
          notificationPreferences:
            (user.notificationPreferences?.preferences as Record<string, boolean>) ?? {},
        }}
        canEditNotifications={canEditNotifications}
      />
    </div>
  );
}
