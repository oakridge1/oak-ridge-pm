"use client";

import { useState, useEffect } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import type { Role } from "@/app/generated/prisma/client";

// Kept inline so this client component has no server-only imports
const PERMISSION_ROWS: { key: string; label: string }[] = [
  { key: "ORDERING",              label: "Send Stock Orders" },
  { key: "CREATE_INVOICES",       label: "Create Invoices" },
  { key: "UPDATE_INVOICE_STATUS", label: "Update Invoice Status" },
  { key: "DELETE_INVOICES",       label: "Delete Invoices" },
  { key: "RECORD_PAYMENTS",       label: "Record Payments" },
  { key: "DELETE_PAYMENTS",       label: "Delete Payments" },
  { key: "ADD_INSPECTIONS",       label: "Add Inspections" },
  { key: "EDIT_INSPECTIONS",      label: "Edit Inspections" },
  { key: "ADD_CHANGE_ORDERS",     label: "Submit Change Orders" },
  { key: "APPROVE_CHANGE_ORDERS", label: "Approve Change Orders" },
  { key: "MANAGE_DOCUMENTS",      label: "Manage Documents" },
  { key: "MANAGE_LABOR",          label: "Log Labor Hours" },
  { key: "MANAGE_MATERIALS",      label: "Log Materials" },
  { key: "ADD_NOTES",             label: "Post Notes" },
  { key: "MANAGE_TASKS",          label: "Manage Tasks" },
  { key: "MANAGE_CALENDAR",       label: "Manage Calendar" },
  { key: "SUBMIT_RFIS",           label: "Submit RFIs" },
  { key: "NOTIFICATION_SETTINGS", label: "Edit Notification Settings" },
  { key: "ESTIMATING",            label: "Estimating Access" },
];

interface UserPermissionGridProps {
  userId: string;
  userRole: Role;
}

export function UserPermissionGrid({ userId, userRole }: UserPermissionGridProps) {
  const [open, setOpen] = useState(false);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ADMIN and OFFICE have all permissions automatically — nothing to manage
  const alwaysGranted = userRole === "ADMIN" || userRole === "OFFICE";

  useEffect(() => {
    if (!open || alwaysGranted) return;
    setLoading(true);
    fetch(`/api/admin/users/${userId}/permissions`)
      .then((r) => r.json())
      .then((data: { permissions: string[]; estimatingPermission: boolean }) => {
        const set = new Set(data.permissions);
        if (data.estimatingPermission) set.add("ESTIMATING");
        setGranted(set);
      })
      .catch(() => setError("Failed to load permissions."))
      .finally(() => setLoading(false));
  }, [open, userId, alwaysGranted]);

  async function handleToggle(key: string) {
    const nowGranted = !granted.has(key);
    setToggling(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: key, granted: nowGranted }),
      });
      if (!res.ok) throw new Error("Request failed");
      setGranted((prev) => {
        const next = new Set(prev);
        if (nowGranted) next.add(key);
        else next.delete(key);
        return next;
      });
    } catch {
      setError("Failed to save — please try again.");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#002D72] border border-gray-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
      >
        <Shield className="w-3 h-3" />
        Permissions
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-2 border border-gray-100 rounded-lg bg-gray-50 p-3">
          {alwaysGranted ? (
            <p className="text-xs text-gray-500 italic">
              {userRole === "ADMIN" ? "Administrator" : "Office"} — all permissions automatically granted.
            </p>
          ) : loading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : (
            <>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded mb-2">
                  {error}
                </p>
              )}
              <div className="space-y-0">
                {PERMISSION_ROWS.map(({ key, label }) => {
                  const on = granted.has(key);
                  const busy = toggling === key;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-xs text-gray-700">{label}</span>
                      <button
                        onClick={() => handleToggle(key)}
                        disabled={busy}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                          on ? "bg-[#002D72]" : "bg-gray-200"
                        }`}
                        aria-label={`Toggle ${label}`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                            on ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
