"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, AlertCircle, ExternalLink, Link2Off,
  RefreshCw, Calendar, Sheet, Building2, Bell, Upload, Truck,
  Edit2, Trash2, Plus, X, Package, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Database,
} from "lucide-react";
import { BOM, BOM_CATEGORIES } from "@/lib/bom";

// ── Notification preference types ─────────────────────────────────────────────

const NOTIFICATION_TYPE_LABELS: { key: string; label: string }[] = [
  { key: "stock_order_sent",          label: "Stock Order Sent" },
  { key: "stock_order_approval_needed", label: "Stock Order Approval Needed" },
  { key: "co_submitted",              label: "CO Submitted" },
  { key: "co_status_changed",         label: "CO Status Changed" },
  { key: "task_assigned",             label: "Task Assigned" },
  { key: "task_completed",            label: "Task Completed" },
  { key: "note_posted",               label: "Note Posted" },
  { key: "inspection_failed",         label: "Inspection Failed" },
  { key: "rfi_answered",              label: "RFI Answered" },
  { key: "calendar_reminder",         label: "Calendar Reminder" },
  { key: "daily_report",              label: "Daily Report" },
  { key: "billing_reminder",          label: "Billing Reminder" },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
  repName: string | null;
  email: string | null;
  phone: string | null;
  accountNumber: string | null;
  deliveryNotes: string | null;
  pickupOnly: boolean;
  notes: string | null;
}

interface StockItem {
  id: string;
  category: string;
  name: string;
  lingo: string | null;
  unitOfMeasure: string;
  isConsumable: boolean;
  notes: string | null;
  sortOrder: number;
}

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
  defaultPaymentTerms: string;
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

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", repName: "", email: "", phone: "", accountNumber: "", deliveryNotes: "", pickupOnly: false, notes: "" });
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [resettingSuppliers, setResettingSuppliers] = useState(false);

  // Notification preferences state (Fix 2)
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [notifPrefsLoaded, setNotifPrefsLoaded] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Stock items state
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockExpanded, setStockExpanded] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockLoaded, setStockLoaded] = useState(false);
  const [addingStock, setAddingStock] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockForm, setStockForm] = useState({ category: "", name: "", lingo: "", unitOfMeasure: "EA", isConsumable: false, notes: "" });
  const [stockSaving, setStockSaving] = useState(false);

  // BOM Pricing overrides state (Fix 9)
  const [bomOverrides, setBomOverrides] = useState<Record<string, { mat: number; lhr: number }>>({});
  const [bomLoaded, setBomLoaded] = useState(false);
  const [bomCatFilter, setBomCatFilter] = useState("All");
  const [bomSearch, setBomSearch] = useState("");
  const [bomEditing, setBomEditing] = useState<string | null>(null); // bomId being edited
  const [bomEditMat, setBomEditMat] = useState("");
  const [bomEditLhr, setBomEditLhr] = useState("");
  const [bomSaving, setBomSaving] = useState(false);
  const [bomSaveError, setBomSaveError] = useState<string | null>(null);

  // Load suppliers on mount
  useEffect(() => {
    fetch("/api/admin/suppliers").then(r => r.json()).then(data => {
      setSuppliers(Array.isArray(data) ? data : []);
      setSuppliersLoaded(true);
    }).catch(() => setSuppliersLoaded(true));
  }, []);

  // Load BOM pricing overrides on mount (Fix 9)
  useEffect(() => {
    fetch("/api/admin/bom-pricing").then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        const map: Record<string, { mat: number; lhr: number }> = {};
        for (const row of data) map[row.id] = { mat: row.mat, lhr: row.lhr };
        setBomOverrides(map);
      }
      setBomLoaded(true);
    }).catch(() => setBomLoaded(true));
  }, []);

  // Load notification preferences on mount (Fix 2)
  useEffect(() => {
    fetch("/api/admin/notification-preferences").then(r => r.json()).then(data => {
      if (data.preferences) setNotifPrefs(data.preferences);
      setNotifPrefsLoaded(true);
    }).catch(() => setNotifPrefsLoaded(true));
  }, []);

  async function handleSaveNotifPrefs() {
    setNotifSaving(true);
    setNotifSaved(false);
    try {
      await fetch("/api/admin/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: notifPrefs }),
      });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 3000);
    } finally {
      setNotifSaving(false);
    }
  }

  // ── BOM Pricing handlers (Fix 9) ────────────────────────────────────────────

  async function handleSaveBomOverride(bomId: string) {
    const mat = parseFloat(bomEditMat);
    const lhr = parseFloat(bomEditLhr);
    if (isNaN(mat) || isNaN(lhr)) {
      setBomSaveError("Enter valid numbers for material cost and labor hours.");
      return;
    }
    setBomSaving(true);
    setBomSaveError(null);
    try {
      const res = await fetch("/api/admin/bom-pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bomId, mat, lhr }),
      });
      if (res.ok) {
        setBomOverrides(prev => ({ ...prev, [bomId]: { mat, lhr } }));
        setBomEditing(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setBomSaveError(data.error ?? `Save failed (${res.status})`);
      }
    } catch {
      setBomSaveError("Network error — save failed.");
    } finally {
      setBomSaving(false);
    }
  }

  async function handleRevertBomOverride(bomId: string) {
    if (!confirm("Remove override and revert to BOM default?")) return;
    await fetch("/api/admin/bom-pricing", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bomId }),
    });
    setBomOverrides(prev => {
      const copy = { ...prev };
      delete copy[bomId];
      return copy;
    });
  }

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

  // ── Supplier handlers ────────────────────────────────────────────────────────

  const emptySupplierForm = { name: "", repName: "", email: "", phone: "", accountNumber: "", deliveryNotes: "", pickupOnly: false, notes: "" };

  async function handleAddSupplier() {
    if (!supplierForm.name.trim()) return;
    setSupplierSaving(true);
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm),
      });
      if (res.ok) {
        const supplier = await res.json();
        setSuppliers(prev => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name)));
        setSupplierForm(emptySupplierForm);
        setAddingSupplier(false);
      }
    } finally {
      setSupplierSaving(false);
    }
  }

  async function handleUpdateSupplier(id: string) {
    if (!supplierForm.name.trim()) return;
    setSupplierSaving(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setSuppliers(prev => prev.map(s => s.id === id ? updated : s).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingSupplierId(null);
        setSupplierForm(emptySupplierForm);
      }
    } finally {
      setSupplierSaving(false);
    }
  }

  async function handleDeleteSupplier(id: string) {
    if (!confirm("Delete this supplier?")) return;
    const res = await fetch(`/api/admin/suppliers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSuppliers(prev => prev.filter(s => s.id !== id));
    }
  }

  async function handleResetSuppliers() {
    if (!confirm("This will DELETE all current suppliers and replace with the default list of 10. Continue?")) return;
    setResettingSuppliers(true);
    try {
      const res = await fetch("/api/admin/suppliers/reset", { method: "POST" });
      if (res.ok) {
        const updated = await fetch("/api/admin/suppliers").then(r => r.json());
        setSuppliers(Array.isArray(updated) ? updated : []);
      }
    } finally {
      setResettingSuppliers(false);
    }
  }

  async function loadStockItems() {
    if (stockLoaded) return;
    setStockLoading(true);
    try {
      const data = await fetch("/api/admin/stock-items").then(r => r.json());
      setStockItems(Array.isArray(data) ? data : []);
      setStockLoaded(true);
    } finally {
      setStockLoading(false);
    }
  }

  async function handleToggleStock() {
    setStockExpanded(prev => !prev);
    if (!stockLoaded) await loadStockItems();
  }

  async function handleAddStock() {
    if (!stockForm.name.trim() || !stockForm.category.trim()) return;
    setStockSaving(true);
    try {
      const res = await fetch("/api/admin/stock-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...stockForm, variables: [] }),
      });
      if (res.ok) {
        const item = await res.json();
        setStockItems(prev => [...prev, item].sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder));
        setStockForm({ category: "", name: "", lingo: "", unitOfMeasure: "EA", isConsumable: false, notes: "" });
        setAddingStock(false);
      }
    } finally {
      setStockSaving(false);
    }
  }

  async function handleUpdateStock(id: string) {
    setStockSaving(true);
    try {
      const res = await fetch(`/api/admin/stock-items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stockForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setStockItems(prev => prev.map(s => s.id === id ? updated : s));
        setEditingStockId(null);
      }
    } finally {
      setStockSaving(false);
    }
  }

  async function handleDeleteStock(id: string) {
    if (!confirm("Delete this stock item?")) return;
    const res = await fetch(`/api/admin/stock-items/${id}`, { method: "DELETE" });
    if (res.ok) setStockItems(prev => prev.filter(s => s.id !== id));
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
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Default Payment Terms</label>
              <select
                value={company.defaultPaymentTerms}
                onChange={(e) => setCompany({ ...company, defaultPaymentTerms: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
              >
                <option value="due_on_receipt">Due on Receipt</option>
                <option value="net_10">Net 10</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
              </select>
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

      {/* ── Suppliers card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-[#002D72]" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Suppliers</h2>
              <p className="text-sm text-gray-500 mt-0.5">Manage your preferred electrical suppliers.</p>
            </div>
          </div>
          <button
            onClick={handleResetSuppliers}
            disabled={resettingSuppliers}
            className="text-xs text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            {resettingSuppliers ? "Resetting…" : "Reset List"}
          </button>
        </div>

        {!suppliersLoaded ? (
          <p className="text-sm text-gray-400">Loading suppliers…</p>
        ) : (
          <div className="space-y-2">
            {suppliers.map(supplier => (
              <div key={supplier.id}>
                {editingSupplierId === supplier.id ? (
                  <div className="border border-[#002D72]/20 rounded-lg p-3 space-y-2 bg-blue-50">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={supplierForm.name}
                        onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Supplier name *"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                      />
                      <input
                        type="text"
                        value={supplierForm.repName}
                        onChange={e => setSupplierForm(f => ({ ...f, repName: e.target.value }))}
                        placeholder="Rep name"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                      />
                      <input
                        type="email"
                        value={supplierForm.email}
                        onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="Rep email"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                      />
                      <input
                        type="tel"
                        value={supplierForm.phone}
                        onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                      />
                      <input
                        type="text"
                        value={supplierForm.accountNumber}
                        onChange={e => setSupplierForm(f => ({ ...f, accountNumber: e.target.value }))}
                        placeholder="Account #"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                      />
                      <input
                        type="text"
                        value={supplierForm.deliveryNotes}
                        onChange={e => setSupplierForm(f => ({ ...f, deliveryNotes: e.target.value }))}
                        placeholder="Delivery notes"
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={supplierForm.pickupOnly}
                        onChange={e => setSupplierForm(f => ({ ...f, pickupOnly: e.target.checked }))}
                        className="rounded" />
                      Pickup only (not for delivery orders)
                    </label>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingSupplierId(null); setSupplierForm(emptySupplierForm); }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                      <button onClick={() => handleUpdateSupplier(supplier.id)} disabled={supplierSaving || !supplierForm.name.trim()}
                        className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60">
                        {supplierSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                        {supplier.pickupOnly && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Pickup only</span>
                        )}
                      </div>
                      {(supplier.repName || supplier.email || supplier.phone) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[supplier.repName, supplier.email, supplier.phone].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {supplier.accountNumber && (
                        <p className="text-xs text-gray-400">Acct: {supplier.accountNumber}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => {
                        setEditingSupplierId(supplier.id);
                        setSupplierForm({
                          name: supplier.name,
                          repName: supplier.repName ?? "",
                          email: supplier.email ?? "",
                          phone: supplier.phone ?? "",
                          accountNumber: supplier.accountNumber ?? "",
                          deliveryNotes: supplier.deliveryNotes ?? "",
                          pickupOnly: supplier.pickupOnly,
                          notes: supplier.notes ?? "",
                        });
                      }}
                        className="p-1.5 text-gray-400 hover:text-[#002D72] hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteSupplier(supplier.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingSupplier ? (
              <div className="border border-[#FF5910]/30 rounded-lg p-3 space-y-2 bg-orange-50">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={supplierForm.name}
                    onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Supplier name *"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={supplierForm.repName}
                    onChange={e => setSupplierForm(f => ({ ...f, repName: e.target.value }))}
                    placeholder="Rep name"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                  />
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Rep email"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                  />
                  <input
                    type="tel"
                    value={supplierForm.phone}
                    onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                  />
                  <input
                    type="text"
                    value={supplierForm.accountNumber}
                    onChange={e => setSupplierForm(f => ({ ...f, accountNumber: e.target.value }))}
                    placeholder="Account #"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                  />
                  <input
                    type="text"
                    value={supplierForm.deliveryNotes}
                    onChange={e => setSupplierForm(f => ({ ...f, deliveryNotes: e.target.value }))}
                    placeholder="Delivery notes"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={supplierForm.pickupOnly}
                    onChange={e => setSupplierForm(f => ({ ...f, pickupOnly: e.target.checked }))}
                    className="rounded" />
                  Pickup only (not for delivery orders)
                </label>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setAddingSupplier(false); setSupplierForm(emptySupplierForm); }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                  <button onClick={handleAddSupplier} disabled={supplierSaving || !supplierForm.name.trim()}
                    className="bg-[#FF5910] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#e04d0e] disabled:opacity-60">
                    {supplierSaving ? "Adding…" : "Add Supplier"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setAddingSupplier(true); setEditingSupplierId(null); setSupplierForm(emptySupplierForm); }}
                className="flex items-center gap-1.5 text-sm font-medium text-[#002D72] hover:text-[#003d99] border border-dashed border-[#002D72]/30 px-4 py-2 rounded-lg w-full justify-center hover:border-[#002D72] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Supplier
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stock List card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <button
          onClick={handleToggleStock}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-[#002D72]" />
            <div className="text-left">
              <h2 className="text-base font-semibold text-gray-900">Stock List</h2>
              <p className="text-sm text-gray-500 mt-0.5">Manage items in The Crib ordering system.</p>
            </div>
          </div>
          {stockExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {stockExpanded && (
          <div className="mt-4 space-y-2">
            {stockLoading ? (
              <p className="text-sm text-gray-400">Loading stock items…</p>
            ) : (
              <>
                {/* Group by category */}
                {[...new Set(stockItems.map(i => i.category))].sort().map(cat => (
                  <div key={cat} className="mb-3">
                    <h4 className="text-xs font-bold text-[#002D72] uppercase tracking-wide mb-1">{cat}</h4>
                    <div className="space-y-1">
                      {stockItems.filter(i => i.category === cat).map(item => (
                        <div key={item.id}>
                          {editingStockId === item.id ? (
                            <div className="border border-[#002D72]/20 rounded-lg p-3 space-y-2 bg-blue-50">
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" value={stockForm.name} onChange={e => setStockForm(f => ({ ...f, name: e.target.value }))}
                                  placeholder="Name *" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                                <input type="text" value={stockForm.lingo} onChange={e => setStockForm(f => ({ ...f, lingo: e.target.value }))}
                                  placeholder="Lingo / shorthand" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                                <input type="text" value={stockForm.unitOfMeasure} onChange={e => setStockForm(f => ({ ...f, unitOfMeasure: e.target.value }))}
                                  placeholder="Unit (EA, Rolls…)" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                                <input type="text" value={stockForm.notes} onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))}
                                  placeholder="Notes" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                              </div>
                              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={stockForm.isConsumable} onChange={e => setStockForm(f => ({ ...f, isConsumable: e.target.checked }))} className="rounded" />
                                Consumable (pickup only)
                              </label>
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditingStockId(null)} className="text-sm text-gray-500 px-2 py-1">Cancel</button>
                                <button onClick={() => handleUpdateStock(item.id)} disabled={stockSaving}
                                  className="bg-[#002D72] text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-60">
                                  {stockSaving ? "Saving…" : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 border border-gray-100">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-900">{item.name}</span>
                                {item.lingo && item.lingo !== item.name && (
                                  <span className="text-xs text-gray-400 ml-2">({item.lingo})</span>
                                )}
                                <span className="text-xs text-gray-400 ml-2">{item.unitOfMeasure}</span>
                                {item.isConsumable && <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded ml-2">Consumable</span>}
                                {item.notes && <span className="text-xs text-orange-500 ml-2 italic">{item.notes}</span>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => {
                                  setEditingStockId(item.id);
                                  setStockForm({ category: item.category, name: item.name, lingo: item.lingo ?? "", unitOfMeasure: item.unitOfMeasure, isConsumable: item.isConsumable, notes: item.notes ?? "" });
                                }} className="p-1 text-gray-400 hover:text-[#002D72] rounded">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDeleteStock(item.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {addingStock ? (
                  <div className="border border-[#FF5910]/30 rounded-lg p-3 space-y-2 bg-orange-50 mt-3">
                    <h4 className="text-xs font-semibold text-gray-700">New Stock Item</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={stockForm.category} onChange={e => setStockForm(f => ({ ...f, category: e.target.value }))}
                        placeholder="Category *" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]" autoFocus />
                      <input type="text" value={stockForm.name} onChange={e => setStockForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Name *" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                      <input type="text" value={stockForm.lingo} onChange={e => setStockForm(f => ({ ...f, lingo: e.target.value }))}
                        placeholder="Lingo / shorthand" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                      <input type="text" value={stockForm.unitOfMeasure} onChange={e => setStockForm(f => ({ ...f, unitOfMeasure: e.target.value }))}
                        placeholder="Unit (EA, Rolls…)" className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={stockForm.isConsumable} onChange={e => setStockForm(f => ({ ...f, isConsumable: e.target.checked }))} className="rounded" />
                      Consumable (pickup only)
                    </label>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setAddingStock(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
                      <button onClick={handleAddStock} disabled={stockSaving || !stockForm.name.trim() || !stockForm.category.trim()}
                        className="bg-[#FF5910] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#e04d0e] disabled:opacity-60">
                        {stockSaving ? "Adding…" : "Add Item"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingStock(true); setEditingStockId(null); }}
                    className="flex items-center gap-1.5 text-sm font-medium text-[#002D72] hover:text-[#003d99] border border-dashed border-[#002D72]/30 px-4 py-2 rounded-lg w-full justify-center hover:border-[#002D72] transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" /> Add Stock Item
                  </button>
                )}
              </>
            )}
          </div>
        )}
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

      {/* ── Notification Preferences card (Fix 2) ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <ToggleRight className="w-5 h-5 text-[#002D72]" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Notification Preferences</h2>
            <p className="text-sm text-gray-500 mt-0.5">Choose which email notifications you receive. Sam&apos;s CC and Admin BCC are always on.</p>
          </div>
        </div>

        {!notifPrefsLoaded ? (
          <p className="text-sm text-gray-400">Loading preferences…</p>
        ) : (
          <div className="space-y-1">
            {NOTIFICATION_TYPE_LABELS.map(({ key, label }) => {
              const enabled = notifPrefs[key] !== false;
              return (
                <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-gray-100">
                  <span className="text-sm text-gray-800">{label}</span>
                  <button
                    onClick={() => setNotifPrefs(p => ({ ...p, [key]: !enabled }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-[#002D72]" : "bg-gray-200"}`}
                    aria-label={`Toggle ${label}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </div>
              );
            })}

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={handleSaveNotifPrefs}
                disabled={notifSaving}
                className="flex items-center gap-2 bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors disabled:opacity-60"
              >
                {notifSaving ? "Saving..." : "Save Preferences"}
              </button>
              {notifSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Saved
                </span>
              )}
            </div>
          </div>
        )}
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

      {/* ── BOM Pricing Overrides card (Fix 9) ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-5 h-5 text-[#FF5910]" />
          <h2 className="text-base font-semibold text-gray-900">BOM Pricing Overrides</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Override default material costs and labor hours for BOM items. Changes apply to all new estimates.
          Items with overrides are highlighted. Leave blank to use the built-in BOM defaults.
        </p>

        {/* Search + filter */}
        <div className="flex gap-2 flex-wrap mb-4">
          <input
            type="text"
            value={bomSearch}
            onChange={e => setBomSearch(e.target.value)}
            placeholder="Search items…"
            className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          />
          <select
            value={bomCatFilter}
            onChange={e => setBomCatFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          >
            <option value="All">All Categories</option>
            {BOM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="flex items-center text-xs text-gray-400 px-2">
            {Object.keys(bomOverrides).length} override{Object.keys(bomOverrides).length !== 1 ? "s" : ""}
          </span>
        </div>

        {bomSaveError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {bomSaveError}
          </div>
        )}

        {!bomLoaded ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Item</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Category</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Default Mat</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Override Mat</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Default Hrs</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Override Hrs</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {BOM
                  .filter(b => {
                    if (bomCatFilter !== "All" && b.category !== bomCatFilter) return false;
                    if (bomSearch) {
                      const q = bomSearch.toLowerCase();
                      if (!b.name.toLowerCase().includes(q) && !b.id.toLowerCase().includes(q)) return false;
                    }
                    return true;
                  })
                  .map(b => {
                    const override = bomOverrides[b.id];
                    const isEditing = bomEditing === b.id;
                    return (
                      <tr key={b.id} className={`border-b border-gray-100 ${override ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-[160px] truncate">{b.name}</td>
                        <td className="px-3 py-2 text-gray-500">{b.category}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">${b.mat.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              value={bomEditMat}
                              onChange={e => setBomEditMat(e.target.value)}
                              step="0.0001"
                              min="0"
                              className="w-20 border border-[#002D72] rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72] text-right"
                            />
                          ) : override ? (
                            <span className="text-amber-700 font-semibold">${override.mat.toFixed(4)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{b.lhr.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              value={bomEditLhr}
                              onChange={e => setBomEditLhr(e.target.value)}
                              step="0.0001"
                              min="0"
                              className="w-20 border border-[#002D72] rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72] text-right"
                            />
                          ) : override ? (
                            <span className="text-amber-700 font-semibold">{override.lhr.toFixed(4)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveBomOverride(b.id)}
                                  disabled={bomSaving}
                                  className="text-xs font-medium text-white bg-[#002D72] px-2 py-1 rounded hover:bg-[#003d99] disabled:opacity-60"
                                >
                                  {bomSaving ? "…" : "Save"}
                                </button>
                                <button
                                  onClick={() => setBomEditing(null)}
                                  className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setBomEditing(b.id);
                                    setBomEditMat(String(override?.mat ?? b.mat));
                                    setBomEditLhr(String(override?.lhr ?? b.lhr));
                                  }}
                                  className="p-1 text-gray-400 hover:text-[#002D72] transition-colors"
                                  title="Edit override"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {override && (
                                  <button
                                    onClick={() => handleRevertBomOverride(b.id)}
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Remove override"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

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
