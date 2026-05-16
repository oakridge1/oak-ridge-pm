"use client";

import { useState } from "react";
import {
  CheckCircle2, AlertCircle, ExternalLink, Link2Off,
  RefreshCw, Calendar, Sheet, Building2, Bell, Upload,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GoogleConnection {
  id: string;
  email: string;
  connectedAt: string;
  scopes: string;
}

interface CompanySettings {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  logoUrl: string | null;
}

interface Props {
  connection: GoogleConnection | null;
  justConnected: boolean;
  connectError: string | null;
  companySettings: CompanySettings;
}

const ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google authorization was denied or cancelled.",
  token_exchange: "Failed to exchange authorization code for tokens.",
  no_refresh_token: "Google did not return a refresh token. Please try reconnecting.",
  userinfo: "Failed to retrieve your Google account info.",
  config_missing: "Google OAuth credentials are not configured on the server.",
};

const scopeLabels: Record<string, string> = {
  "https://www.googleapis.com/auth/spreadsheets": "Google Sheets (read & write)",
  "https://www.googleapis.com/auth/calendar": "Google Calendar (read & write)",
  email: "Email address",
  profile: "Basic profile info",
};

// ── Main component ─────────────────────────────────────────────────────────────

export function SettingsClient({ connection, justConnected, connectError, companySettings }: Props) {
  // Google state
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; updated: number; failed: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Company Info state
  const [company, setCompany] = useState<CompanySettings>(companySettings);
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // Test email state
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok?: boolean; recipients?: number; error?: string } | null>(null);

  // ── Google handlers ──────────────────────────────────────────────────────────

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect Google? This will remove all stored tokens.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      if (res.ok) window.location.href = "/admin/settings";
      else alert("Failed to disconnect. Please try again.");
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
      if (!res.ok) setSyncError(data.error ?? "Sync failed");
      else setSyncResult(data);
    } catch {
      setSyncError("An unexpected error occurred during sync.");
    } finally {
      setSyncing(false);
    }
  }

  // ── Company Info handlers ────────────────────────────────────────────────────

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setCompanySaving(true);
    setCompanySaved(false);
    setCompanyError(null);
    try {
      const res = await fetch("/api/admin/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompanyError(data.error ?? "Failed to save settings");
      } else {
        setCompanySaved(true);
        setTimeout(() => setCompanySaved(false), 3000);
      }
    } catch {
      setCompanyError("An unexpected error occurred.");
    } finally {
      setCompanySaving(false);
    }
  }

  // ── Test email handler ───────────────────────────────────────────────────────

  async function handleTestEmail() {
    setTestingEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/admin/test-email", { method: "POST" });
      const data = await res.json();
      setTestEmailResult(data);
    } catch {
      setTestEmailResult({ error: "Request failed" });
    } finally {
      setTestingEmail(false);
    }
  }

  const scopeList = connection?.scopes.split(" ").filter(Boolean) ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Status banners ── */}
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

      {/* ── Company Info card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-5 h-5 text-[#002D72]" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Company Info</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Used in invoice headers, PDF footers, and email signatures.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCompany} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={company.city}
                onChange={(e) => setCompany({ ...company, city: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={company.state}
                  onChange={(e) => setCompany({ ...company, state: e.target.value })}
                  maxLength={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ZIP</label>
                <input
                  type="text"
                  value={company.zip}
                  onChange={(e) => setCompany({ ...company, zip: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={company.logoUrl ?? ""}
                onChange={(e) => setCompany({ ...company, logoUrl: e.target.value || null })}
                placeholder="https://... (paste URL of uploaded logo)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
              />
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Upload className="w-3 h-3" />
                Upload the logo file separately and paste the URL here. Appears on all PDF invoices.
              </p>
            </div>
          </div>

          {companyError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {companyError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={companySaving}
              className="flex items-center gap-2 bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors disabled:opacity-60"
            >
              {companySaving ? "Saving..." : "Save Company Info"}
            </button>
            {companySaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── Notifications card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-[#002D72]" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-500 mt-0.5">Email notification settings for the workspace.</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm mb-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Email notifications</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" /> Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Daily report delivery</span>
            <span className="text-gray-900 font-medium">4:00 AM EST</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Sam Cosme permanent CC</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" /> Always on
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Admin auto-BCC</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" /> Always on
            </span>
          </div>
        </div>

        {testEmailResult?.ok && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2 mb-4">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Test email sent to {testEmailResult.recipients} admin{testEmailResult.recipients !== 1 ? "s" : ""} + Sam Cosme.
          </div>
        )}
        {testEmailResult?.error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {testEmailResult.error}
          </div>
        )}

        <button
          onClick={handleTestEmail}
          disabled={testingEmail}
          className="flex items-center gap-2 bg-[#FF5910] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e04d0e] transition-colors disabled:opacity-60"
        >
          <Bell className={`w-4 h-4 ${testingEmail ? "animate-pulse" : ""}`} />
          {testingEmail ? "Sending..." : "Send Test Email"}
        </button>
      </div>

      {/* ── Google Integration card ── */}
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
              <CheckCircle2 className="w-3 h-3" /> Active
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
                    <li key={scope} className="text-gray-700">{scopeLabels[scope] ?? scope}</li>
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

      {/* ── Google Calendar Sync card ── */}
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
              <AlertCircle className="w-4 h-4 shrink-0" /> {syncError}
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

      {/* ── AIA Invoice → Google Sheets card ── */}
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
