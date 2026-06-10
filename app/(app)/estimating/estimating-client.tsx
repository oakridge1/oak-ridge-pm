"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calculator, Plus, X, Search } from "lucide-react";
import type { EstimateStatus } from "@/app/generated/prisma/client";

type EstimateRow = {
  id: string;
  estimateNumber: string;
  name: string;
  clientName: string | null;
  status: EstimateStatus;
  createdAt: string;
  awardedAt: string | null;
  takeoffItems: unknown;
  assemblies: unknown;
  panelItems: unknown;
  permits: unknown;
  subs: unknown;
  laborRate: number;
  bulkMarkup: number;
  lightMarkup: number;
  permitMarkup: number;
  subMarkup: number;
  overhead: number;
  profit: number;
  nonProd: number;
  designFeePct: number;
  conditionMult: number;
  heightAdj: boolean;
  notes: string | null;
  jobNumberAssigned: string | null;
  jobId: string | null;
  designFeeUserId: string | null;
  createdById: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null } | null;
  designFeeUser: { id: string; name: string | null } | null;
  job: { id: string; jobNumber: string } | null;
};

const STATUS_TABS: Array<{ label: string; value: EstimateStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Awarded", value: "AWARDED" },
  { label: "Lost", value: "LOST" },
  { label: "Archived", value: "ARCHIVED" },
];

const STATUS_BADGE: Record<EstimateStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  AWARDED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-400 italic",
};

interface Props {
  estimates: EstimateRow[];
  isAdmin: boolean;
}

export function EstimatingClient({ estimates, isAdmin }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<EstimateStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filtered = estimates.filter(e => {
    if (tab !== "ALL" && e.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.name.toLowerCase().includes(q) && !(e.clientName ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), clientName: newClient.trim() || null, address: newAddress.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      router.push(`/estimating/${data.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create estimate");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1e3a8a] flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Estimating</h1>
            <p className="text-sm text-gray-500">{estimates.length} estimate{estimates.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#1e3a8a] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#003d99] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Estimate
        </button>
      </div>

      {/* New Estimate Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1e3a8a]">New Estimate</h2>
              <button onClick={() => setShowNew(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Project Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Smith Residence Service Upgrade"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client Name</label>
                <input
                  type="text"
                  value={newClient}
                  onChange={e => setNewClient(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowNew(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="bg-[#1e3a8a] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
              >
                {creating ? "Creating…" : "Create Estimate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or client…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] bg-white"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-[#1e3a8a] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Estimates table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No estimates found</p>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {filtered.map(e => (
              <Link
                key={e.id}
                href={`/estimating/${e.id}`}
                className="block w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-[#1e3a8a]/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{e.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{e.estimateNumber}</div>
                    {e.clientName && <div className="text-xs text-gray-500">{e.clientName}</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_BADGE[e.status]}`}>
                    {e.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {new Date(e.createdAt).toLocaleDateString()} · {e.createdBy?.name ?? "—"}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Est #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Job #</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors group">
                    <td className="px-0">
                      <Link href={`/estimating/${e.id}`} className="block px-4 py-3 font-mono text-xs text-gray-500">
                        {e.estimateNumber}
                      </Link>
                    </td>
                    <td className="px-0">
                      <Link href={`/estimating/${e.id}`} className="block px-4 py-3 font-medium text-gray-900">
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-0">
                      <Link href={`/estimating/${e.id}`} className="block px-4 py-3 text-sm text-gray-600">
                        {e.clientName ?? "—"}
                      </Link>
                    </td>
                    <td className="px-0">
                      <Link href={`/estimating/${e.id}`} className="block px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[e.status]}`}>
                          {e.status}
                        </span>
                      </Link>
                    </td>
                    <td className="px-0">
                      <Link href={`/estimating/${e.id}`} className="block px-4 py-3 text-sm text-gray-600">
                        {e.createdBy?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-0">
                      <Link href={`/estimating/${e.id}`} className="block px-4 py-3 text-sm text-gray-500">
                        {new Date(e.createdAt).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="px-0">
                      <Link href={`/estimating/${e.id}`} className="block px-4 py-3 text-sm text-gray-500 font-mono">
                        {e.job?.jobNumber ?? e.jobNumberAssigned ?? "—"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
