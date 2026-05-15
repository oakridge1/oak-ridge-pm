"use client";

import { useTransition, useState } from "react";
import { Trash2, ShieldCheck, User, Clock, UserPlus, X, Save } from "lucide-react";
import { updateUserRole, toggleUserActive, deleteUser, createUser } from "./actions";
import type { Role } from "@/app/generated/prisma/client";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  active: boolean;
  createdAt: Date;
};

interface UserTableProps {
  users: UserRow[];
  currentUserId: string;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  OFFICE: "Office",
  FOREMAN: "Foreman",
  TEAMMATE: "Teammate",
};

function UserAvatar({ user }: { user: UserRow }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name ?? user.email}
        className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
      />
    );
  }
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-[#002D72] text-white flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  );
}

function UserRowMobile({
  user,
  currentUserId,
}: {
  user: UserRow;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isSelf = user.id === currentUserId;

  function handleRoleChange(role: Role) {
    startTransition(() => updateUserRole(user.id, role));
  }

  function handleToggleActive() {
    startTransition(() => toggleUserActive(user.id, !user.active));
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setDeleteError(null); return; }
    startTransition(async () => {
      try {
        await deleteUser(user.id);
        setConfirmDelete(false);
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : "Delete failed.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 mb-3 ${
        !user.active ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
      } ${pending ? "opacity-60 pointer-events-none" : ""}`}
    >
      <div className="flex items-start gap-3">
        <UserAvatar user={user} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">
              {user.name ?? "(no name)"}
            </span>
            {isSelf && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                You
              </span>
            )}
            {!user.active && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pending
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
        </div>
      </div>

      {deleteError && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">
          {deleteError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={user.role}
          onChange={(e) => handleRoleChange(e.target.value as Role)}
          disabled={isSelf}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#002D72]"
        >
          {(["ADMIN", "OFFICE", "FOREMAN", "TEAMMATE"] as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>

        <button
          onClick={handleToggleActive}
          disabled={isSelf}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            user.active
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}
        >
          {user.active ? "Active" : "Activate"}
        </button>

        {!isSelf && (
          <button
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
              confirmDelete ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmDelete ? "Confirm?" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

function UserRowDesktop({
  user,
  currentUserId,
}: {
  user: UserRow;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isSelf = user.id === currentUserId;

  function handleRoleChange(role: Role) {
    startTransition(() => updateUserRole(user.id, role));
  }

  function handleToggleActive() {
    startTransition(() => toggleUserActive(user.id, !user.active));
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setDeleteError(null); return; }
    startTransition(async () => {
      try {
        await deleteUser(user.id);
        setConfirmDelete(false);
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : "Delete failed.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <tr
      className={`border-b last:border-b-0 transition-opacity ${
        !user.active ? "bg-amber-50" : "bg-white hover:bg-gray-50"
      } ${pending ? "opacity-60 pointer-events-none" : ""}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 text-sm">
                {user.name ?? "(no name)"}
              </span>
              {isSelf && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                  You
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={user.role}
          onChange={(e) => handleRoleChange(e.target.value as Role)}
          disabled={isSelf}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#002D72]"
        >
          {(["ADMIN", "OFFICE", "FOREMAN", "TEAMMATE"] as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleToggleActive}
          disabled={isSelf}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ${
            user.active
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}
        >
          {user.active ? (
            <><ShieldCheck className="w-3.5 h-3.5" /> Active</>
          ) : (
            <><Clock className="w-3.5 h-3.5" /> Pending — Activate</>
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        {!isSelf && (
          <div className="space-y-1">
            <button
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                confirmDelete ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmDelete ? "Confirm delete?" : "Delete"}
            </button>
            {deleteError && (
              <p className="text-xs text-red-600 max-w-[200px]">{deleteError}</p>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("TEAMMATE");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await createUser(email, name, role);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create user.");
      }
    });
  }

  return (
    <div className="mb-6 bg-blue-50 border border-[#002D72]/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#002D72] flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Add New User
        </h3>
        <button onClick={onDone} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value as Role)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]">
            {(["ADMIN", "OFFICE", "FOREMAN", "TEAMMATE"] as Role[]).map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        The user will be pre-activated and set to this role. They must sign in with Google using this exact email address.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <button onClick={handleSave} disabled={pending || !email.trim()}
          className="flex items-center gap-1.5 bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors">
          <Save className="w-3.5 h-3.5" />
          {pending ? "Creating…" : "Create User"}
        </button>
      </div>
    </div>
  );
}

export function UserTable({ users, currentUserId }: UserTableProps) {
  const pending = users.filter((u) => !u.active);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div>
      {/* Add User */}
      {showAddForm ? (
        <AddUserForm onDone={() => setShowAddForm(false)} />
      ) : (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800">
            {pending.length} user{pending.length > 1 ? "s" : ""} awaiting activation
          </span>
        </div>
      )}

      {/* Mobile */}
      <div className="md:hidden">
        {users.map((u) => (
          <UserRowMobile key={u.id} user={u} currentUserId={currentUserId} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRowDesktop key={u.id} user={u} currentUserId={currentUserId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
