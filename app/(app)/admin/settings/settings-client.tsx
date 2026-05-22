"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, AlertCircle, ExternalLink, Link2Off,
  RefreshCw, Calendar, Sheet, Building2, Bell, Upload, Truck,
  Edit2, Trash2, Plus, X, Package, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Database, DollarSign, Save, Car, FileSpreadsheet, Receipt, Archive,
  Send, UserCheck,
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

interface Vehicle {
  id: string;
  tag: string;
  year: string | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  primaryDriver: string | null;
  notes: string | null;
  isActive: boolean;
}

interface PayrollMatchedRow {
  csvName: string;
  userId: string;
  userName: string;
  regularHours: number;
  otHours: number;
  grossPay: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  confirmed: boolean;
}

interface PayrollUnmatchedRow {
  csvName: string;
  regularHours: number;
  otHours: number;
  grossPay: number;
}

interface SimpleUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
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

  // Labor Rates state
  const [laborRates, setLaborRates] = useState<{ defaultBurden: number; bidRates: Record<string, number> } | null>(null);
  const [laborRatesLoaded, setLaborRatesLoaded] = useState(false);
  const [editingBurden, setEditingBurden] = useState(false);
  const [burdenInput, setBurdenInput] = useState("35");
  const [editingBidRateKey, setEditingBidRateKey] = useState<string | null>(null);
  const [bidRateInput, setBidRateInput] = useState("");
  const [laborRatesSaving, setLaborRatesSaving] = useState(false);
  const [laborRatesSaved, setLaborRatesSaved] = useState(false);
  const [laborRatesError, setLaborRatesError] = useState<string | null>(null);

  // ── Vehicles state ────────────────────────────────────────────────────────────
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState({ tag: "", year: "", make: "", model: "", plate: "", primaryDriver: "", notes: "" });
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleDeleteId, setVehicleDeleteId] = useState<string | null>(null);

  // ── Vehicle cost log state ────────────────────────────────────────────────────
  interface VehicleCost { id: string; category: string | null; amount: number | null; receiptDate: string | null; description: string | null; vendor: string | null; imageUrl: string | null; }
  const [logCostVehicleId, setLogCostVehicleId] = useState<string | null>(null);
  const [costForm, setCostForm] = useState({ costType: "Maintenance", amount: "", date: new Date().toISOString().slice(0, 10), description: "" });
  const [costSaving, setCostSaving] = useState(false);
  const [costSuccess, setCostSuccess] = useState<string | null>(null);
  const costFileInputRef = useRef<HTMLInputElement>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [vehicleCosts, setVehicleCosts] = useState<Record<string, VehicleCost[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  // ── Payroll Import state ──────────────────────────────────────────────────────
  const payrollFileRef = useRef<HTMLInputElement>(null);
  const [payrollPreviewing, setPayrollPreviewing] = useState(false);
  const [payrollMatched, setPayrollMatched] = useState<PayrollMatchedRow[] | null>(null);
  const [payrollUnmatched, setPayrollUnmatched] = useState<PayrollUnmatchedRow[] | null>(null);
  const [payrollPreviewError, setPayrollPreviewError] = useState<string | null>(null);
  const [payrollConfirming, setPayrollConfirming] = useState(false);
  const [payrollResult, setPayrollResult] = useState<string | null>(null);

  // ── Receipt Reminders state ────────────────────────────────────────────────────
  const [mondayReminder, setMondayReminder] = useState(false);
  const [fridayReminder, setFridayReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("Please upload any receipts before starting today.");
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [showManualRemind, setShowManualRemind] = useState(false);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [allUsersLoaded, setAllUsersLoaded] = useState(false);
  const [selectedReminderUsers, setSelectedReminderUsers] = useState<string[]>([]);
  const [sendingManualRemind, setSendingManualRemind] = useState(false);
  const [manualRemindResult, setManualRemindResult] = useState<string | null>(null);

  // ── Year-End Close state ──────────────────────────────────────────────────────
  const [systemJobs, setSystemJobs] = useState<{ id: string; jobNumber: string; jobName: string }[]>([]);
  const [systemJobsLoaded, setSystemJobsLoaded] = useState(false);
  const [yearEndConfirming, setYearEndConfirming] = useState(false);
  const [yearEndRunning, setYearEndRunning] = useState(false);
  const [yearEndResult, setYearEndResult] = useState<string | null>(null);
  const [yearEndError, setYearEndError] = useState<string | null>(null);

  // BOM Pricing overrides state (Fix 9)
  const [bomOverrides, setBomOverrides] = useState<Record<string, { mat: number; lhr: number }>>({});
  const [bomLoaded, setBomLoaded] = useState(false);
  const [bomCatFilter, setBomCatFilter] = useState("All");
  const [bomSearch, setBomSearch] = useState("");
  const [bomEditing, setBomEditing] = useState<string | null>(null); // bomId being edited
  const [bomEditFocus, setBomEditFocus] = useState<"mat" | "lhr">("mat"); // which field to focus
  const [bomEditMat, setBomEditMat] = useState("");
  const [bomEditLhr, setBomEditLhr] = useState("");
  const [bomSaving, setBomSaving] = useState<string | null>(null); // bomId being saved
  const [bomRowStatus, setBomRowStatus] = useState<Record<string, "ok" | "err">>({});

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

  // Load labor rates on mount
  useEffect(() => {
    fetch("/api/admin/company-rates").then(r => r.json()).then(data => {
      setLaborRates({ defaultBurden: data.defaultBurden ?? 0.35, bidRates: data.bidRates ?? {} });
      setBurdenInput(String(Math.round((data.defaultBurden ?? 0.35) * 100)));
      setLaborRatesLoaded(true);
    }).catch(() => setLaborRatesLoaded(true));
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

  // ── Labor Rates handlers ─────────────────────────────────────────────────────

  async function handleSaveBurden() {
    if (!laborRates) return;
    const val = parseFloat(burdenInput) / 100;
    if (isNaN(val) || val < 0 || val > 2) { setLaborRatesError("Burden rate must be 0–200%."); return; }
    setLaborRatesSaving(true); setLaborRatesError(null);
    try {
      const res = await fetch("/api/admin/company-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultBurden: val, bidRates: laborRates.bidRates }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setLaborRatesError(d.error ?? "Save failed"); return; }
      const updated = await res.json();
      setLaborRates({ defaultBurden: updated.defaultBurden, bidRates: updated.bidRates });
      setEditingBurden(false);
      setLaborRatesSaved(true); setTimeout(() => setLaborRatesSaved(false), 3000);
    } catch { setLaborRatesError("Network error — save failed."); }
    finally { setLaborRatesSaving(false); }
  }

  async function handleSaveBidRate(key: string) {
    if (!laborRates) return;
    const val = parseFloat(bidRateInput);
    if (isNaN(val) || val < 0) { setLaborRatesError("Enter a valid rate."); return; }
    const newRates = { ...laborRates.bidRates, [key]: val };
    setLaborRatesSaving(true); setLaborRatesError(null);
    try {
      const res = await fetch("/api/admin/company-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultBurden: laborRates.defaultBurden, bidRates: newRates }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setLaborRatesError(d.error ?? "Save failed"); return; }
      const updated = await res.json();
      setLaborRates({ defaultBurden: updated.defaultBurden, bidRates: updated.bidRates });
      setEditingBidRateKey(null);
      setLaborRatesSaved(true); setTimeout(() => setLaborRatesSaved(false), 3000);
    } catch { setLaborRatesError("Network error — save failed."); }
    finally { setLaborRatesSaving(false); }
  }

  // ── BOM Pricing handlers (Fix 9) ────────────────────────────────────────────

  function flashRowStatus(bomId: string, status: "ok" | "err") {
    setBomRowStatus(prev => ({ ...prev, [bomId]: status }));
    setTimeout(() => setBomRowStatus(prev => {
      const c = { ...prev };
      delete c[bomId];
      return c;
    }), status === "ok" ? 2000 : 3000);
  }

  async function handleSaveBomOverride(bomId: string) {
    const mat = parseFloat(bomEditMat);
    const lhr = parseFloat(bomEditLhr);
    if (isNaN(mat) || isNaN(lhr)) {
      flashRowStatus(bomId, "err");
      return;
    }
    setBomSaving(bomId);
    setBomRowStatus(prev => { const c = { ...prev }; delete c[bomId]; return c; });
    try {
      const res = await fetch("/api/admin/bom-pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bomId, mat, lhr }),
      });
      if (res.ok) {
        setBomOverrides(prev => ({ ...prev, [bomId]: { mat, lhr } }));
        setBomEditing(null);
        flashRowStatus(bomId, "ok");
      } else {
        flashRowStatus(bomId, "err");
      }
    } catch {
      flashRowStatus(bomId, "err");
    } finally {
      setBomSaving(null);
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

  // ── Vehicles effects & handlers ──────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/admin/vehicles").then(r => r.json()).then(data => {
      setVehicles(Array.isArray(data) ? data : []);
      setVehiclesLoaded(true);
    }).catch(() => setVehiclesLoaded(true));
  }, []);

  const emptyVehicleForm = { tag: "", year: "", make: "", model: "", plate: "", primaryDriver: "", notes: "" };

  async function handleAddVehicle() {
    if (!vehicleForm.tag.trim()) return;
    setVehicleSaving(true);
    try {
      const res = await fetch("/api/admin/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicleForm),
      });
      if (res.ok) {
        const v = await res.json();
        setVehicles(prev => [...prev, v].sort((a, b) => a.tag.localeCompare(b.tag)));
        setVehicleForm(emptyVehicleForm);
        setAddingVehicle(false);
      }
    } finally {
      setVehicleSaving(false);
    }
  }

  async function handleUpdateVehicle(id: string) {
    if (!vehicleForm.tag.trim()) return;
    setVehicleSaving(true);
    try {
      const res = await fetch(`/api/admin/vehicles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicleForm),
      });
      if (res.ok) {
        const v = await res.json();
        setVehicles(prev => prev.map(x => x.id === id ? v : x).sort((a, b) => a.tag.localeCompare(b.tag)));
        setEditingVehicleId(null);
        setVehicleForm(emptyVehicleForm);
      }
    } finally {
      setVehicleSaving(false);
    }
  }

  async function handleDeleteVehicle(id: string) {
    setVehicleDeleteId(null);
    const res = await fetch(`/api/admin/vehicles/${id}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      if (data.softDeleted) {
        // Soft-deleted: mark inactive in list
        setVehicles(prev => prev.map(x => x.id === id ? { ...x, isActive: false } : x));
      } else {
        setVehicles(prev => prev.filter(x => x.id !== id));
      }
    }
  }

  // ── Vehicle cost handlers ─────────────────────────────────────────────────────

  async function handleLogCost(vehicleId: string) {
    if (!costForm.amount) return;
    setCostSaving(true);
    try {
      let receiptUrl: string | null = null;
      const file = costFileInputRef.current?.files?.[0];
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("endpoint", "receiptImage");
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (up.ok) { const d = await up.json(); receiptUrl = d.url ?? null; }
      }

      const res = await fetch(`/api/admin/vehicles/${vehicleId}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costType: costForm.costType,
          amount: parseFloat(costForm.amount),
          date: costForm.date,
          description: costForm.description,
          receiptUrl,
        }),
      });

      if (res.ok) {
        setCostSuccess(vehicleId);
        setCostForm({ costType: "Maintenance", amount: "", date: new Date().toISOString().slice(0, 10), description: "" });
        if (costFileInputRef.current) costFileInputRef.current.value = "";
        setTimeout(() => {
          setCostSuccess(null);
          setLogCostVehicleId(null);
          // Refresh cost history if it was open
          if (historyOpenId === vehicleId) {
            setVehicleCosts(prev => ({ ...prev, [vehicleId]: [] }));
            loadVehicleCosts(vehicleId);
          }
        }, 1500);
      }
    } finally {
      setCostSaving(false);
    }
  }

  async function loadVehicleCosts(vehicleId: string) {
    setHistoryLoading(vehicleId);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicleId}/costs`);
      if (res.ok) {
        const data = await res.json();
        setVehicleCosts(prev => ({ ...prev, [vehicleId]: data }));
      }
    } finally {
      setHistoryLoading(null);
    }
  }

  function toggleCostHistory(vehicleId: string) {
    if (historyOpenId === vehicleId) {
      setHistoryOpenId(null);
    } else {
      setHistoryOpenId(vehicleId);
      if (!vehicleCosts[vehicleId]) {
        loadVehicleCosts(vehicleId);
      }
    }
  }

  // ── Payroll handlers ──────────────────────────────────────────────────────────

  async function handlePayrollPreview() {
    const file = payrollFileRef.current?.files?.[0];
    if (!file) return;
    setPayrollPreviewing(true);
    setPayrollPreviewError(null);
    setPayrollMatched(null);
    setPayrollUnmatched(null);
    setPayrollResult(null);
    try {
      const fd = new FormData();
      fd.append("csv", file);
      const res = await fetch("/api/admin/payroll/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setPayrollPreviewError(data.error ?? "Preview failed"); return; }
      const matched: PayrollMatchedRow[] = (data.matched ?? []).map((r: Omit<PayrollMatchedRow, "confirmed">) => ({ ...r, confirmed: true }));
      setPayrollMatched(matched);
      setPayrollUnmatched(data.unmatched ?? []);
    } catch { setPayrollPreviewError("Network error"); }
    finally { setPayrollPreviewing(false); }
  }

  async function handlePayrollConfirm() {
    if (!payrollMatched) return;
    const records = payrollMatched.filter(r => r.confirmed).map(r => ({
      userId: r.userId,
      regularHours: r.regularHours,
      otHours: r.otHours,
      grossPay: r.grossPay,
      payPeriodStart: r.payPeriodStart,
      payPeriodEnd: r.payPeriodEnd,
    }));
    if (records.length === 0) return;
    setPayrollConfirming(true);
    try {
      const res = await fetch("/api/admin/payroll/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const data = await res.json();
      if (!res.ok) { setPayrollPreviewError(data.error ?? "Confirm failed"); return; }
      setPayrollResult(`Imported payroll for ${data.imported} employee${data.imported !== 1 ? "s" : ""}.`);
      setPayrollMatched(null);
      setPayrollUnmatched(null);
      if (payrollFileRef.current) payrollFileRef.current.value = "";
    } finally { setPayrollConfirming(false); }
  }

  // ── Receipt Reminders handlers ────────────────────────────────────────────────

  async function loadAllUsers() {
    if (allUsersLoaded) return;
    try {
      const data = await fetch("/api/admin/users").then(r => r.json());
      setAllUsers(Array.isArray(data) ? data : []);
      setAllUsersLoaded(true);
    } catch { setAllUsersLoaded(true); }
  }

  async function handleSaveReminderSettings() {
    setReminderSaving(true);
    setReminderSaved(false);
    // Store locally for now (persistence via PATCH /api/admin/company-settings would require schema extension)
    // This saves the UI state in the component; a real backend call would go here.
    await new Promise(r => setTimeout(r, 300));
    setReminderSaved(true);
    setTimeout(() => setReminderSaved(false), 3000);
    setReminderSaving(false);
  }

  async function handleSendManualRemind() {
    if (selectedReminderUsers.length === 0) return;
    setSendingManualRemind(true);
    setManualRemindResult(null);
    try {
      const res = await fetch("/api/admin/receipts/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedReminderUsers, message: reminderMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setManualRemindResult(data.message ?? "Reminder sent.");
        setShowManualRemind(false);
        setSelectedReminderUsers([]);
      }
    } finally { setSendingManualRemind(false); }
  }

  // ── Year-End Close handlers ───────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/admin/system-jobs").then(r => r.json()).then(data => {
      setSystemJobs(Array.isArray(data) ? data : []);
      setSystemJobsLoaded(true);
    }).catch(() => setSystemJobsLoaded(true));
  }, []);

  async function handleYearEndClose() {
    setYearEndRunning(true);
    setYearEndError(null);
    setYearEndResult(null);
    try {
      const res = await fetch("/api/admin/system-jobs/year-end-close", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setYearEndError(data.error ?? "Year-end close failed."); return; }
      const createdList = (data.created ?? []).map((j: { jobNumber: string; jobName: string }) => `${j.jobNumber} ${j.jobName}`).join(", ");
      setYearEndResult(`Archived ${data.archived} system job${data.archived !== 1 ? "s" : ""}. Created: ${createdList}.`);
      setYearEndConfirming(false);
      // Refresh system jobs list
      setSystemJobs(prev => {
        const closed = prev.map(j => ({ ...j, status: "COMPLETED" }));
        return closed;
      });
    } catch { setYearEndError("Network error."); }
    finally { setYearEndRunning(false); }
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

      {/* ── Labor Rates card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-[#FF5910]" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Labor Rates</h2>
              <p className="text-sm text-gray-500 mt-0.5">Bid rates by trade level and default burden rate used in profitability calculations.</p>
            </div>
          </div>
          {laborRatesSaved && (
            <span className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="w-4 h-4" /> Saved</span>
          )}
        </div>

        {laborRatesError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {laborRatesError}
          </div>
        )}

        {!laborRatesLoaded ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : (
          <div className="space-y-4">
            {/* Default burden rate */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Default Burden Rate</p>
                <p className="text-xs text-gray-500">Applied to actual hourly wages (taxes, benefits, insurance)</p>
              </div>
              {editingBurden ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input type="number" value={burdenInput} onChange={e => setBurdenInput(e.target.value)}
                      step="1" min="0" max="200" placeholder="35"
                      className="w-20 border border-gray-300 rounded-lg px-2 pr-6 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  <button onClick={handleSaveBurden} disabled={laborRatesSaving}
                    className="flex items-center gap-1 text-xs bg-[#002D72] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#003d99] disabled:opacity-60">
                    <Save className="w-3 h-3" /> {laborRatesSaving ? "…" : "Save"}
                  </button>
                  <button onClick={() => setEditingBurden(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-[#002D72]">
                    {laborRates ? Math.round(laborRates.defaultBurden * 100) : 35}%
                  </span>
                  <button onClick={() => { setEditingBurden(true); setBurdenInput(String(Math.round((laborRates?.defaultBurden ?? 0.35) * 100))); }}
                    className="p-1.5 text-gray-400 hover:text-[#002D72] transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Bid rates table */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bid Rates by Trade Level</p>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Title</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Year</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Bid Rate / hr</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {laborRates && Object.entries(laborRates.bidRates).map(([key, rate]) => {
                      const [title, year] = key.split(":");
                      const isEditingThis = editingBidRateKey === key;
                      return (
                        <tr key={key} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-800">{title}</td>
                          <td className="px-4 py-2.5 text-gray-500">{year || "—"}</td>
                          <td className="px-4 py-2.5 text-right">
                            {isEditingThis ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                  <input type="number" value={bidRateInput} onChange={e => setBidRateInput(e.target.value)}
                                    step="0.50" min="0" placeholder="0.00"
                                    className="w-20 border border-gray-300 rounded px-4 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72] text-right" />
                                </div>
                                <button onClick={() => handleSaveBidRate(key)} disabled={laborRatesSaving}
                                  className="text-xs bg-[#002D72] text-white px-2 py-1 rounded hover:bg-[#003d99] disabled:opacity-60">
                                  {laborRatesSaving ? "…" : "Save"}
                                </button>
                                <button onClick={() => setEditingBidRateKey(null)} className="text-xs text-gray-500">✕</button>
                              </div>
                            ) : (
                              <span className="font-semibold text-gray-900 tabular-nums">${rate.toFixed(2)}/hr</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            {!isEditingThis && (
                              <button onClick={() => { setEditingBidRateKey(key); setBidRateInput(String(rate)); }}
                                className="p-1 text-gray-300 hover:text-[#002D72] transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {laborRates && Object.keys(laborRates.bidRates).length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-4 text-sm text-gray-400 text-center">No bid rates configured. Run the seed endpoint first.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

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

        {!bomLoaded ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Item</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Category</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Mat Cost</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Labor Hrs</th>
                  <th className="px-3 py-2 w-8" />
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
                    const rowStatus = bomRowStatus[b.id];
                    const isSaving = bomSaving === b.id;
                    const effectiveMat = override?.mat ?? b.mat;
                    const effectiveLhr = override?.lhr ?? b.lhr;

                    function startEditing(field: "mat" | "lhr") {
                      setBomEditing(b.id);
                      setBomEditFocus(field);
                      setBomEditMat(String(effectiveMat));
                      setBomEditLhr(String(effectiveLhr));
                    }

                    return (
                      <tr key={b.id} className={`border-b border-gray-100 ${override ? "bg-amber-50" : ""}`}>
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-[160px] truncate" title={b.name}>{b.name}</td>
                        <td className="px-3 py-2 text-gray-500">{b.category}</td>

                        {/* Mat Cost cell — click to edit */}
                        <td
                          className={`px-3 py-2 text-right font-mono ${!isEditing ? "cursor-pointer hover:bg-blue-50 select-none" : ""}`}
                          onClick={!isEditing ? () => startEditing("mat") : undefined}
                          title={!isEditing ? "Click to edit" : undefined}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              value={bomEditMat}
                              onChange={e => setBomEditMat(e.target.value)}
                              onBlur={e => {
                                // Don't save if focus moved to the lhr input in this row
                                if ((e.relatedTarget as HTMLElement)?.id === `bom-lhr-${b.id}`) return;
                                handleSaveBomOverride(b.id);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") { e.preventDefault(); handleSaveBomOverride(b.id); }
                                if (e.key === "Escape") { e.preventDefault(); setBomEditing(null); }
                              }}
                              step="0.0001"
                              min="0"
                              autoFocus={bomEditFocus === "mat"}
                              className="w-20 border border-[#002D72] rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72] text-right"
                            />
                          ) : (
                            <span className={override ? "text-amber-700 font-semibold" : "text-gray-700"}>
                              ${effectiveMat.toFixed(4)}
                            </span>
                          )}
                        </td>

                        {/* Labor Hrs cell — click to edit */}
                        <td
                          className={`px-3 py-2 text-right font-mono ${!isEditing ? "cursor-pointer hover:bg-blue-50 select-none" : ""}`}
                          onClick={!isEditing ? () => startEditing("lhr") : undefined}
                          title={!isEditing ? "Click to edit" : undefined}
                        >
                          {isEditing ? (
                            <input
                              id={`bom-lhr-${b.id}`}
                              type="number"
                              value={bomEditLhr}
                              onChange={e => setBomEditLhr(e.target.value)}
                              onBlur={() => handleSaveBomOverride(b.id)}
                              onKeyDown={e => {
                                if (e.key === "Enter") { e.preventDefault(); handleSaveBomOverride(b.id); }
                                if (e.key === "Escape") { e.preventDefault(); setBomEditing(null); }
                              }}
                              step="0.0001"
                              min="0"
                              autoFocus={bomEditFocus === "lhr"}
                              className="w-20 border border-[#002D72] rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72] text-right"
                            />
                          ) : (
                            <span className={override ? "text-amber-700 font-semibold" : "text-gray-700"}>
                              {effectiveLhr.toFixed(4)}
                            </span>
                          )}
                        </td>

                        {/* Status / revert column */}
                        <td className="px-2 py-2 w-8 text-center">
                          {isSaving ? (
                            <span className="text-gray-400 text-xs">…</span>
                          ) : rowStatus === "ok" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 inline" />
                          ) : rowStatus === "err" ? (
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 inline" />
                          ) : override && !isEditing ? (
                            <button
                              onClick={() => handleRevertBomOverride(b.id)}
                              className="p-0.5 text-gray-300 hover:text-red-400 transition-colors"
                              title="Remove override"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : null}
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

      {/* ── Vehicles card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Car className="w-5 h-5 text-[#002D72]" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Fleet &amp; Vehicles</h2>
              <p className="text-sm text-gray-500 mt-0.5">Manage company vehicles and primary drivers.</p>
            </div>
          </div>
        </div>

        {!vehiclesLoaded ? (
          <p className="text-sm text-gray-400">Loading vehicles…</p>
        ) : (
          <div className="space-y-2">
            {vehicles.map(v => (
              <div key={v.id}>
                {editingVehicleId === v.id ? (
                  <div className="border border-[#002D72]/20 rounded-lg p-3 space-y-2 bg-blue-50">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <input type="text" value={vehicleForm.tag} onChange={e => setVehicleForm(f => ({ ...f, tag: e.target.value }))}
                        placeholder="Tag (e.g. ORE1) *" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                      <input type="text" value={vehicleForm.year} onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))}
                        placeholder="Year" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                      <input type="text" value={vehicleForm.make} onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))}
                        placeholder="Make" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                      <input type="text" value={vehicleForm.model} onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))}
                        placeholder="Model" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                      <input type="text" value={vehicleForm.plate} onChange={e => setVehicleForm(f => ({ ...f, plate: e.target.value }))}
                        placeholder="Plate" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                      <input type="text" value={vehicleForm.primaryDriver} onChange={e => setVehicleForm(f => ({ ...f, primaryDriver: e.target.value }))}
                        placeholder="Primary Driver" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                    </div>
                    <input type="text" value={vehicleForm.notes} onChange={e => setVehicleForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Notes" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingVehicleId(null); setVehicleForm(emptyVehicleForm); }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                      <button onClick={() => handleUpdateVehicle(v.id)} disabled={vehicleSaving || !vehicleForm.tag.trim()}
                        className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60">
                        {vehicleSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#002D72]">{v.tag}</span>
                          {(v.year || v.make || v.model) && (
                            <span className="text-sm text-gray-700">{[v.year, v.make, v.model].filter(Boolean).join(" ")}</span>
                          )}
                          {v.plate && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{v.plate}</span>}
                          {v.primaryDriver && <span className="text-xs text-gray-500">{v.primaryDriver}</span>}
                          {!v.isActive && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactive</span>}
                          {v.isActive && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Active</span>}
                        </div>
                        {v.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{v.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setLogCostVehicleId(logCostVehicleId === v.id ? null : v.id); setCostForm({ costType: "Maintenance", amount: "", date: new Date().toISOString().slice(0, 10), description: "" }); }}
                          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-2 py-1 rounded-lg transition-colors"
                        >
                          Log Cost
                        </button>
                        <button onClick={() => {
                          setEditingVehicleId(v.id);
                          setVehicleForm({ tag: v.tag, year: v.year ?? "", make: v.make ?? "", model: v.model ?? "", plate: v.plate ?? "", primaryDriver: v.primaryDriver ?? "", notes: v.notes ?? "" });
                          setAddingVehicle(false);
                        }} className="p-1.5 text-gray-400 hover:text-[#002D72] hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setVehicleDeleteId(v.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Log Cost inline form */}
                    {logCostVehicleId === v.id && (
                      <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 space-y-2">
                        <p className="text-xs font-medium text-gray-700">Log a vehicle cost</p>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={costForm.costType}
                            onChange={e => setCostForm(f => ({ ...f, costType: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                          >
                            {["Tires", "Registration", "Maintenance", "Inspection", "Repair", "Other"].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="number" step="0.01" min="0" required
                              value={costForm.amount}
                              onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))}
                              placeholder="Amount"
                              className="w-full border border-gray-300 rounded-lg pl-5 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                            />
                          </div>
                          <input
                            type="date"
                            value={costForm.date}
                            onChange={e => setCostForm(f => ({ ...f, date: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                          />
                          <input
                            type="text"
                            value={costForm.description}
                            onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Description"
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                          />
                        </div>
                        <input
                          ref={costFileInputRef}
                          type="file" accept="image/*" capture="environment"
                          className="text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                        />
                        <div className="flex items-center gap-2 justify-end pt-1">
                          {costSuccess === v.id && (
                            <span className="text-xs text-green-600 font-medium">Saved!</span>
                          )}
                          <button onClick={() => setLogCostVehicleId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                          <button
                            onClick={() => handleLogCost(v.id)}
                            disabled={costSaving || !costForm.amount}
                            className="bg-[#002D72] text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-[#003d99] disabled:opacity-60"
                          >
                            {costSaving ? "Saving…" : "Save Cost"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Cost history toggle */}
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => toggleCostHistory(v.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <span>View Cost History</span>
                        {historyOpenId === v.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {historyOpenId === v.id && (
                        <div className="px-3 pb-3 space-y-1">
                          {historyLoading === v.id ? (
                            <p className="text-xs text-gray-400 py-2">Loading…</p>
                          ) : !vehicleCosts[v.id] || vehicleCosts[v.id].length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">No costs recorded yet.</p>
                          ) : (
                            <>
                              {vehicleCosts[v.id].slice(0, 5).map(c => (
                                <div key={c.id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                                  <span className="text-gray-400 shrink-0">{c.receiptDate ? new Date(c.receiptDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
                                  <span className="text-gray-600 font-medium shrink-0">{c.category ?? "—"}</span>
                                  <span className="text-gray-900 font-semibold shrink-0">${(c.amount ?? 0).toFixed(2)}</span>
                                  {c.description && <span className="text-gray-400 truncate">{c.description}</span>}
                                </div>
                              ))}
                              <a href={`/admin/receipts?vehicleId=${v.id}`} className="block text-xs text-[#002D72] hover:underline pt-1">View All →</a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Delete confirm dialog */}
                {vehicleDeleteId === v.id && (
                  <div className="mt-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                    <p className="text-sm text-red-800">Delete <strong>{v.tag}</strong>? This cannot be undone.</p>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setVehicleDeleteId(null)} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1">Cancel</button>
                      <button onClick={() => handleDeleteVehicle(v.id)} className="bg-red-600 text-white text-sm px-3 py-1 rounded-lg hover:bg-red-700">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingVehicle ? (
              <div className="border border-[#FF5910]/30 rounded-lg p-3 space-y-2 bg-orange-50">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <input type="text" value={vehicleForm.tag} onChange={e => setVehicleForm(f => ({ ...f, tag: e.target.value }))}
                    placeholder="Tag (e.g. ORE2) *" autoFocus className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                  <input type="text" value={vehicleForm.year} onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))}
                    placeholder="Year" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                  <input type="text" value={vehicleForm.make} onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))}
                    placeholder="Make" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                  <input type="text" value={vehicleForm.model} onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="Model" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                  <input type="text" value={vehicleForm.plate} onChange={e => setVehicleForm(f => ({ ...f, plate: e.target.value }))}
                    placeholder="Plate" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                  <input type="text" value={vehicleForm.primaryDriver} onChange={e => setVehicleForm(f => ({ ...f, primaryDriver: e.target.value }))}
                    placeholder="Primary Driver" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                </div>
                <input type="text" value={vehicleForm.notes} onChange={e => setVehicleForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setAddingVehicle(false); setVehicleForm(emptyVehicleForm); }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                  <button onClick={handleAddVehicle} disabled={vehicleSaving || !vehicleForm.tag.trim()}
                    className="bg-[#FF5910] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#e04d0e] disabled:opacity-60">
                    {vehicleSaving ? "Adding…" : "Add Vehicle"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setAddingVehicle(true); setEditingVehicleId(null); setVehicleForm(emptyVehicleForm); }}
                className="flex items-center gap-1.5 text-sm font-medium text-[#002D72] hover:text-[#003d99] border border-dashed border-[#002D72]/30 px-4 py-2 rounded-lg w-full justify-center hover:border-[#002D72] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Vehicle
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Payroll Import card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-[#002D72]" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Payroll (Gusto CSV Import)</h2>
            <p className="text-sm text-gray-500 mt-0.5">Upload a Gusto payroll CSV to allocate labor costs.</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Expected CSV columns:</p>
          <p className="text-blue-700 font-mono text-xs">Employee Name, Pay Period Start, Pay Period End, Regular Hours, Overtime Hours, Gross Pay</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select CSV file</label>
            <input ref={payrollFileRef} type="file" accept=".csv" onChange={() => { setPayrollMatched(null); setPayrollUnmatched(null); setPayrollResult(null); setPayrollPreviewError(null); }}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#002D72] file:text-white hover:file:bg-[#003d99]" />
          </div>

          {payrollPreviewError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {payrollPreviewError}
            </div>
          )}

          {payrollResult && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {payrollResult}
            </div>
          )}

          {/* Preview table */}
          {(payrollMatched !== null || payrollUnmatched !== null) && (
            <div className="space-y-3">
              {payrollMatched && payrollMatched.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Matched Employees</p>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">CSV Name</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Matched User</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Reg Hrs</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">OT Hrs</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Gross Pay</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-500">Import</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollMatched.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-b-0">
                            <td className="px-3 py-2 text-gray-700">{r.csvName}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-green-600" /> {r.userName}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.regularHours.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.otHours.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">${r.grossPay.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={r.confirmed}
                                onChange={e => setPayrollMatched(prev => prev ? prev.map((x, j) => j === i ? { ...x, confirmed: e.target.checked } : x) : prev)}
                                className="rounded" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {payrollUnmatched && payrollUnmatched.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Unmatched Employees</p>
                  <div className="rounded-xl border border-red-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50 border-b border-red-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-red-500">CSV Name</th>
                          <th className="px-3 py-2 text-right font-semibold text-red-500">Reg Hrs</th>
                          <th className="px-3 py-2 text-right font-semibold text-red-500">OT Hrs</th>
                          <th className="px-3 py-2 text-right font-semibold text-red-500">Gross Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollUnmatched.map((r, i) => (
                          <tr key={i} className="border-b border-red-100 last:border-b-0 bg-red-50/50">
                            <td className="px-3 py-2 text-red-700 font-medium">{r.csvName} <span className="text-red-400 font-normal">— Not matched</span></td>
                            <td className="px-3 py-2 text-right tabular-nums text-red-700">{r.regularHours.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-red-700">{r.otHours.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-red-700">${r.grossPay.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {payrollMatched && payrollMatched.some(r => r.confirmed) && (
                <button onClick={handlePayrollConfirm} disabled={payrollConfirming}
                  className="flex items-center gap-2 bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60">
                  <CheckCircle2 className="w-4 h-4" />
                  {payrollConfirming ? "Importing…" : `Confirm Import (${payrollMatched.filter(r => r.confirmed).length} employee${payrollMatched.filter(r => r.confirmed).length !== 1 ? "s" : ""})`}
                </button>
              )}
            </div>
          )}

          <button onClick={handlePayrollPreview} disabled={payrollPreviewing}
            className="flex items-center gap-2 bg-[#FF5910] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e04d0e] disabled:opacity-60">
            <Upload className="w-4 h-4" />
            {payrollPreviewing ? "Previewing…" : "Preview Import"}
          </button>
        </div>
      </div>

      {/* ── Receipt Reminders card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="w-5 h-5 text-[#002D72]" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Receipt Reminders (Sam&apos;s Crib)</h2>
            <p className="text-sm text-gray-500 mt-0.5">Automated and manual receipt upload reminders for the crew.</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Scheduled toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-800">Monday morning reminder</p>
                <p className="text-xs text-gray-400">Sent at 7:00 AM every Monday</p>
              </div>
              <button
                onClick={() => setMondayReminder(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${mondayReminder ? "bg-[#002D72]" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${mondayReminder ? "translate-x-4" : "translate-x-1"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-800">Friday afternoon reminder</p>
                <p className="text-xs text-gray-400">Sent at 3:00 PM every Friday</p>
              </div>
              <button
                onClick={() => setFridayReminder(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${fridayReminder ? "bg-[#002D72]" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${fridayReminder ? "translate-x-4" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          {/* Reminder message */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reminder Message</label>
            <textarea
              value={reminderMessage}
              onChange={e => setReminderMessage(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72] resize-none"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleSaveReminderSettings} disabled={reminderSaving}
              className="flex items-center gap-2 bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60">
              <Save className="w-4 h-4" />
              {reminderSaving ? "Saving…" : "Save Settings"}
            </button>
            {reminderSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="w-4 h-4" /> Saved</span>
            )}
            <button onClick={() => { setShowManualRemind(v => !v); if (!allUsersLoaded) loadAllUsers(); }}
              className="flex items-center gap-2 text-sm font-medium text-[#FF5910] border border-[#FF5910]/30 px-4 py-2 rounded-lg hover:bg-[#FF5910]/5 transition-colors">
              <Send className="w-4 h-4" /> Send Manual Reminder
            </button>
          </div>

          {/* Manual remind form */}
          {showManualRemind && (
            <div className="border border-[#FF5910]/20 rounded-lg p-4 bg-orange-50 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Select users to notify:</p>
              {!allUsersLoaded ? (
                <p className="text-sm text-gray-400">Loading users…</p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-48 overflow-y-auto">
                  {allUsers.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer px-2 py-1 rounded hover:bg-white">
                      <input type="checkbox"
                        checked={selectedReminderUsers.includes(u.id)}
                        onChange={e => setSelectedReminderUsers(prev => e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id))}
                        className="rounded" />
                      <span>{u.name ?? u.email}</span>
                    </label>
                  ))}
                </div>
              )}
              {manualRemindResult && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {manualRemindResult}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowManualRemind(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                <button onClick={handleSendManualRemind} disabled={sendingManualRemind || selectedReminderUsers.length === 0}
                  className="flex items-center gap-2 bg-[#FF5910] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#e04d0e] disabled:opacity-60">
                  <Send className="w-3.5 h-3.5" />
                  {sendingManualRemind ? "Sending…" : `Send to ${selectedReminderUsers.length} user${selectedReminderUsers.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Year-End Close card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Archive className="w-5 h-5 text-[#002D72]" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Year-End Close</h2>
            <p className="text-sm text-gray-500 mt-0.5">Archive current system jobs and create next-year jobs.</p>
          </div>
        </div>

        {/* Current system jobs */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current System Jobs</p>
          {!systemJobsLoaded ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : systemJobs.length === 0 ? (
            <p className="text-sm text-gray-500">No active system jobs found.</p>
          ) : (
            <div className="space-y-1">
              {systemJobs.map(j => (
                <div key={j.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-sm font-mono font-semibold text-[#002D72]">{j.jobNumber}</span>
                  <span className="text-sm text-gray-700">{j.jobName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {yearEndResult && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-3 py-2 mb-4">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {yearEndResult}
          </div>
        )}

        {yearEndError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {yearEndError}
          </div>
        )}

        {!yearEndConfirming ? (
          <button
            onClick={() => setYearEndConfirming(true)}
            disabled={!!yearEndResult}
            className="flex items-center gap-2 bg-[#FF5910] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e04d0e] transition-colors disabled:opacity-60"
          >
            <Archive className="w-4 h-4" />
            Close Year &amp; Create New System Jobs
          </button>
        ) : (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
            <p className="text-sm text-red-800 font-medium">Are you sure?</p>
            <p className="text-sm text-red-700">
              This will archive the current system jobs and create next-year equivalents. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setYearEndConfirming(false)} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5">Cancel</button>
              <button onClick={handleYearEndClose} disabled={yearEndRunning}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                <Archive className="w-3.5 h-3.5" />
                {yearEndRunning ? "Closing…" : "Yes, Close Year"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
