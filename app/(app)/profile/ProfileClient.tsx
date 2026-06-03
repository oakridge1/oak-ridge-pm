"use client";

import { useState, useTransition } from "react";
import { updateMyName, updateMyNotificationPreferences } from "./actions";
import type { Role } from "@/app/generated/prisma/client";

const NOTIFICATION_TYPES: { key: string; label: string }[] = [
  { key: "stock_order_sent",           label: "Stock Order Sent" },
  { key: "stock_order_approval_needed", label: "Stock Order Approval Needed" },
  { key: "co_submitted",               label: "CO Submitted" },
  { key: "co_status_changed",          label: "CO Status Changed" },
  { key: "task_assigned",              label: "Task Assigned" },
  { key: "task_completed",             label: "Task Completed" },
  { key: "note_posted",                label: "Note Posted" },
  { key: "inspection_failed",          label: "Inspection Failed" },
  { key: "rfi_answered",               label: "RFI Answered" },
  { key: "calendar_reminder",          label: "Calendar Reminder" },
  { key: "schedule_change",            label: "Schedule Change" },
  { key: "daily_report",               label: "Daily Report" },
  { key: "billing_reminder",           label: "Billing Reminder" },
];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN:    "Administrator",
  OFFICE:   "Office",
  FOREMAN:  "Foreman",
  TEAMMATE: "Team Member",
};

interface ProfileClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    notificationPreferences: Record<string, boolean>;
  };
}

export function ProfileClient({ user }: ProfileClientProps) {
  // ── Personal info ──────────────────────────────────────────────────────────
  const [nameValue, setNameValue] = useState(user.name);
  const [namePending, startNameTransition] = useTransition();
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  function handleSaveName() {
    setNameError(null);
    setNameSaved(false);
    startNameTransition(async () => {
      try {
        await updateMyName(nameValue);
        setNameSaved(true);
        setTimeout(() => setNameSaved(false), 2000);
      } catch (err) {
        setNameError(err instanceof Error ? err.message : "Failed to save name");
      }
    });
  }

  // ── Notification preferences ───────────────────────────────────────────────
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const { key } of NOTIFICATION_TYPES) {
      // Default to ON if no stored preference exists
      initial[key] = user.notificationPreferences[key] !== false;
    }
    return initial;
  });
  const [prefsPending, startPrefsTransition] = useTransition();
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  function handleTogglePref(key: string) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  function handleSavePrefs() {
    setPrefsSaved(false);
    setPrefsError(null);
    startPrefsTransition(async () => {
      try {
        await updateMyNotificationPreferences(prefs);
        setPrefsSaved(true);
        setTimeout(() => setPrefsSaved(false), 2000);
      } catch (err) {
        setPrefsError(err instanceof Error ? err.message : "Failed to save preferences");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Personal Info ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Personal Info</h2>
        <div className="space-y-5">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                placeholder="Your name"
              />
              <button
                onClick={handleSaveName}
                disabled={namePending || !nameValue.trim()}
                className="bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors shrink-0"
              >
                {namePending ? "Saving…" : "Save"}
              </button>
            </div>
            {nameError && (
              <p className="text-xs text-red-600 mt-1.5">{nameError}</p>
            )}
            {nameSaved && (
              <p className="text-xs text-green-600 mt-1.5">Name updated!</p>
            )}
          </div>

          {/* Email — read-only */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Email
            </label>
            <p className="text-sm text-gray-900">{user.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Contact your administrator to update your email.
            </p>
          </div>

          {/* Role — read-only */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Role
            </label>
            <p className="text-sm text-gray-900">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
        </div>
      </div>

      {/* ── Notification Preferences ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Notification Preferences
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Choose which email notifications you receive.
        </p>

        <div className="space-y-0">
          {NOTIFICATION_TYPES.map(({ key, label }) => {
            const enabled = prefs[key] !== false;
            return (
              <div
                key={key}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-700">{label}</span>
                <button
                  onClick={() => handleTogglePref(key)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    enabled ? "bg-[#002D72]" : "bg-gray-200"
                  }`}
                  aria-label={`Toggle ${label}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      enabled ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSavePrefs}
            disabled={prefsPending}
            className="bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
          >
            {prefsPending ? "Saving…" : "Save Preferences"}
          </button>
          {prefsSaved && (
            <span className="text-sm text-green-600 font-medium">Saved!</span>
          )}
          {prefsError && (
            <span className="text-sm text-red-600">{prefsError}</span>
          )}
        </div>
      </div>
    </div>
  );
}
