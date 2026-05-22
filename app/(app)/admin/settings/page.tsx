import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const justConnected = sp.connected === "1";
  const connectError = sp.error ?? null;

  const [connection, rawSettings] = await Promise.all([
    prisma.googleConnection.findFirst(),
    prisma.companySettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
  ]);

  const settings = {
    name: rawSettings.name,
    address: rawSettings.address,
    city: rawSettings.city,
    state: rawSettings.state,
    zip: rawSettings.zip,
    phone: rawSettings.phone,
    email: rawSettings.email,
    logoUrl: rawSettings.logoUrl,
    defaultPaymentTerms: rawSettings.defaultPaymentTerms,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002D72]">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage integrations and application settings.
        </p>
      </div>

      {/* Admin nav */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4">
        <a href="/admin/users" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Users
        </a>
        <a href="/admin/saved-tasks" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Saved Tasks
        </a>
        <a href="/admin/receipts" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Receipts
        </a>
        <a href="/admin/settings" className="text-sm font-medium text-[#002D72] border-b-2 border-[#002D72] pb-1 -mb-5">
          Settings
        </a>
      </div>

      <SettingsClient
        connection={
          connection
            ? {
                id: connection.id,
                email: connection.email,
                connectedAt: connection.connectedAt.toISOString(),
                scopes: connection.scopes,
              }
            : null
        }
        justConnected={justConnected}
        connectError={connectError}
        companySettings={settings}
      />
    </div>
  );
}
