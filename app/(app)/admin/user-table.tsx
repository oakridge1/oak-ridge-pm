"use client";

import { useState, useTransition } from "react";
import { updateUserRole, toggleUserActive, deleteUser } from "./actions";
import type { Role } from "@/app/generated/prisma/client";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  active: boolean;
  createdAt: Date;
};

const ROLES: Role[] = ["ADMIN", "OFFICE", "FOREMAN", "TEAMMATE"];

const roleLabel: Record<Role, string> = {
  ADMIN: "Admin",
  OFFICE: "Office",
  FOREMAN: "Foreman",
  TEAMMATE: "Teammate",
};

const roleBg: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  OFFICE: "bg-blue-100 text-blue-800",
  FOREMAN: "bg-orange-100 text-orange-800",
  TEAMMATE: "bg-green-100 text-green-800",
};

export function UserTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleRoleChange = (userId: string, role: Role) => {
    startTransition(() => updateUserRole(userId, role));
  };

  const handleToggleActive = (userId: string, active: boolean) => {
    startTransition(() => toggleUserActive(userId, active));
  };

  const handleDelete = (userId: string) => {
    if (confirmDelete !== userId) {
      setConfirmDelete(userId);
      return;
    }
    setConfirmDelete(null);
    startTransition(() => deleteUser(userId));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#002D72] text-white text-left">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr
                key={user.id}
                className={`transition-colors ${isPending ? "opacity-60" : ""} ${
                  !user.active ? "bg-amber-50" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#002D72] flex items-center justify-center text-white text-xs font-bold">
                        {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <span className="font-medium text-gray-800">
                      {user.name ?? "—"}
                      {user.id === currentUserId && (
                        <span className="ml-1 text-xs text-gray-400">(you)</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleRoleChange(user.id, e.target.value as Role)
                    }
                    disabled={isPending || user.id === currentUserId}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72] disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(user.id, !user.active)}
                    disabled={isPending || user.id === currentUserId}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                      user.active
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    }`}
                  >
                    {user.active ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        Pending
                      </>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={isPending}
                      className={`p-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                        confirmDelete === user.id
                          ? "bg-red-600 text-white"
                          : "text-red-400 hover:bg-red-50"
                      }`}
                      title={
                        confirmDelete === user.id
                          ? "Click again to confirm"
                          : "Remove user"
                      }
                    >
                      {confirmDelete === user.id ? (
                        "Confirm delete?"
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-gray-100">
        {users.map((user) => (
          <div
            key={user.id}
            className={`p-4 ${!user.active ? "bg-amber-50" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#002D72] flex items-center justify-center text-white text-sm font-bold">
                    {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div>
                  <div className="font-medium text-gray-800 text-sm">
                    {user.name ?? "—"}
                    {user.id === currentUserId && (
                      <span className="ml-1 text-xs text-gray-400">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
              </div>
              {user.id !== currentUserId && (
                <button
                  onClick={() => handleDelete(user.id)}
                  disabled={isPending}
                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                    confirmDelete === user.id
                      ? "bg-red-600 text-white"
                      : "text-red-400 hover:bg-red-50"
                  }`}
                >
                  {confirmDelete === user.id ? "Confirm?" : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <select
                value={user.role}
                onChange={(e) =>
                  handleRoleChange(user.id, e.target.value as Role)
                }
                disabled={isPending || user.id === currentUserId}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72] disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </select>

              <button
                onClick={() => handleToggleActive(user.id, !user.active)}
                disabled={isPending || user.id === currentUserId}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  user.active
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {user.active ? (
                  <><CheckCircle className="w-3.5 h-3.5" /> Active</>
                ) : (
                  <><XCircle className="w-3.5 h-3.5" /> Pending — tap to activate</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="py-12 text-center text-gray-400 text-sm">
          No users yet. Team members appear here after their first sign-in.
        </div>
      )}
    </div>
  );
}
