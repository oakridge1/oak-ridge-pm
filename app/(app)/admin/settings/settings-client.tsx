"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, ExternalLink, Link2Off, RefreshCw, Calendar, Sheet } from "lucide-react";

interface GoogleConnection {
  id: string;
  email: string;
  connectedAt: string;
  scopes: string;
}

interface Props {
  connection: GoogleConnection | null;
  justConnected: boolean;
  connectError: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google authorization was denied or cancelled.",
  token_exchange: "Failed to exchange authorization code for tokens.",
  no_refresh_token: "Google did not return a refresh token. Please try reconnecting.",
  userinfo: "Failed to retrieve your Google account info.",
  config_missing: "Google OAuth credentials are not configured on the server.",
};

export function GoogleSettingsClient({ connection, justConnected, connectError }: Props) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; updated: number; failed: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect Google? This will remove all stored tokens.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      if (res.ok) {
        window.location.href = "/admin/settings";
      } else {
        alert("Failed to disconnect. Please try again.");
      }
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSyncCalendar() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/google/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Sync failed");
      } else {
        setSyncResult(data);
      }
    } catch {
      setSyncError("An unexpected error occurred during sync.");
    } finally {
      setSyncing(false);
    }
  }

  const scopeLabels: Record<string, string> = {
    "https://www.googleapis.com/auth/spreadsheets": "Google Sheets (read & write)",
    "https://www.googleapis.com/auth/calendar": "Google Calendar (read & write)",
    email: "Email address",
    profile: "Basic profile info",
  };

  const scopeList = connection?.scopes.split(" ").filter(Boolean) ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status banners */}
      {justConnected && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Google account connected successfully.
        </div>
      )}
      {connectError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {ERROR_MESSAGES[connectError] ?? `Connection error: ${connectError}`}
        </div>
      )}

      {/* Google Integration card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Google Integration</h2>
            <p className="text-sm text-gray-500 mt-1">
              Connect a Google account to enable Sheets and Calendar sync for this workspace.
            </p>
          </div>
          {connection && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          )}
        </div>

        {connection ? (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">Account</span>
                <span className="font-medium text-gray-900">{connection.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">Connected</span>
                <span className="text-gray-700">
                  {new Date(connection.connectedAt).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-500 w-28 shrink-0 pt-0.5">Scopes</span>
                <ul className="space-y-0.5">
                  {scopeList.map((scope) => (
                    <li key={scope} className="text-gray-700">
                      {scopeLabels[scope] ?? scope}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <a
                href="/api/google/auth"
                className="flex items-center gap-1.5 text-sm font-medium text-[#002D72] border border-[#002D72]/30 px-3 py-2 rounded-lg hover:bg-[#002D72]/5 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Reconnect
              </a>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 text-sm font-medium text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <Link2Off className="w-4 h-4" />
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Connecting your Google account allows the app to create AIA G702/G703 invoices
              directly in Google Sheets and sync calendar events to Google Calendar.
              You will be prompted to authorize the required permissions.
            </p>
            <a
              href="/api/google/auth"
              className="inline-flex items-center gap-2 bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Connect Google Account
            </a>
          </div>
        )}
      </div>

      {/* Google Calendar Sync card — only if connected */}
      {connection && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-[#FF5910]" />
            <h2 className="text-base font-semibold text-gray-900">Google Calendar Sync</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Push all app calendar events to your connected Google Calendar. Events already synced
            will be updated, and new events will be created. Recurrence rules are preserved.
          </p>

          {syncResult && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2 mb-4">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Sync complete — {syncResult.synced} created, {syncResult.updated} updated
              {syncResult.failed > 0 && `, ${syncResult.failed} failed`}.
            </div>
          )}

          {syncError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {syncError}
            </div>
          )}

          <button
            onClick={handleSyncCalendar}
            disabled={syncing}
            className="flex items-center gap-2 bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Calendar Events"}
          </button>
        </div>
      )}

      {/* AIA Invoice → Google Sheets card — only if connected */}
      {connection && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <Sheet className="w-5 h-5 text-[#FF5910]" />
            <h2 className="text-base font-semibold text-gray-900">AIA Invoice → Google Sheets</h2>
          </div>
          <p className="text-sm text-gray-600">
            AIA G702/G703 invoices can be pushed directly to Google Sheets with full formatting,
            including the application summary (G702) and line-item continuation sheet (G703).
          </p>
          <p className="text-sm text-gray-500 mt-2">
            To use this feature, open any job&apos;s Summary tab and expand an AIA invoice.
            An <strong className="font-medium text-gray-700">Open in Sheets</strong> button will
            appear alongside the PDF and other actions.
          </p>
        </div>
      )}
    </div>
  );
}
