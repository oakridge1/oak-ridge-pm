"use client";

import { useState } from "react";

interface ReportsTabProps {
  job: {
    id: string;
    jobNumber: string;
    jobName: string;
    gcCompany?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };
  reports: Array<{
    id: string;
    reportType: string;
    title: string;
    status: string;
    certNumber: string | null;
    overallResult: string | null;
    inspectionDate: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    _count: { findings: number; fixtures: number };
  }>;
  role: string;
}

const REPORT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string; border: string; bar: string }> = {
  FIELD_INVESTIGATION: {
    label: "Field Investigation Report",
    icon: "🔍",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    bar: "#1e3a8a",
  },
  EMERGENCY_LIGHTING: {
    label: "Emergency Lighting Inspection",
    icon: "🔦",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    bar: "#FF5910",
  },
  INFRARED_THERMAL: {
    label: "Infrared Thermal Scan",
    icon: "🌡",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "#dc2626",
  },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  FINAL: { label: "Final", className: "bg-green-100 text-green-700" },
};

const RESULT_CONFIG: Record<string, { label: string; className: string }> = {
  PASS: { label: "PASS", className: "text-green-600 font-bold" },
  FAIL: { label: "FAIL", className: "text-red-600 font-bold" },
  CONDITIONAL: { label: "CONDITIONAL", className: "text-amber-600 font-bold" },
};

type NewType = "FIELD_INVESTIGATION" | "EMERGENCY_LIGHTING" | "INFRARED_THERMAL";

export function ReportsTab({ job, reports, role }: ReportsTabProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<NewType>("FIELD_INVESTIGATION");

  const canCreate = role === "ADMIN" || role === "OFFICE";

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: newType, title: newTitle.trim() }),
      });
      if (!res.ok) throw new Error();
      const { reportId } = await res.json();
      window.location.href = `/jobs/${job.id}/reports/${reportId}`;
    } catch {
      alert("Failed to create report.");
      setCreating(false);
    }
  };

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">Reports</h2>
          <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
            {reports.length}
          </span>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNewModal(true)}
            className="px-3 py-1.5 text-sm font-semibold bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800 transition-colors"
          >
            + New Report
          </button>
        )}
      </div>

      {/* Empty state */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center border border-dashed border-gray-200 rounded-xl py-12 px-6">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm font-medium text-gray-900">No reports yet</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">
            Field investigation reports, emergency lighting inspections, and infrared scans will appear here.
          </p>
          {canCreate && (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 px-3 py-1.5 text-sm font-semibold bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              + New Report
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reports.map((report) => {
            const typeConfig = REPORT_TYPES[report.reportType] ?? REPORT_TYPES.FIELD_INVESTIGATION;
            const statusConfig = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.DRAFT;
            const resultConfig = report.overallResult ? RESULT_CONFIG[report.overallResult] : null;
            return (
              <div key={report.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                {/* Color bar at top based on type */}
                <div className="h-1" style={{ backgroundColor: typeConfig.bar }} />

                <div className="p-4">
                  {/* Row 1: type badge + status badge */}
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${typeConfig.bg} ${typeConfig.color} ${typeConfig.border}`}>
                      {typeConfig.icon} {typeConfig.label}
                    </span>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${statusConfig.className}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Row 2: title */}
                  <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>

                  {/* Row 3: cert number */}
                  {report.certNumber && (
                    <p className="text-xs text-gray-400 mb-2">Cert #{report.certNumber}</p>
                  )}

                  {/* Row 4: metadata */}
                  <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500 mb-3">
                    {report.inspectionDate && (
                      <span>{new Date(report.inspectionDate).toLocaleDateString()}</span>
                    )}
                    {report._count.findings > 0 && <span>{report._count.findings} findings</span>}
                    {report._count.fixtures > 0 && <span>{report._count.fixtures} fixtures</span>}
                    {resultConfig && <span className={resultConfig.className}>{resultConfig.label}</span>}
                  </div>

                  {/* Row 5: action buttons */}
                  <div className="flex gap-2">
                    <a
                      href={`/jobs/${job.id}/reports/${report.id}`}
                      className="flex-1 text-center px-3 py-1.5 text-sm bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800 transition-colors"
                    >
                      {report.status === "DRAFT" ? "Edit Report" : "View Report"}
                    </a>
                    {report.status === "FINAL" && (
                      <a
                        href={`/api/jobs/${job.id}/reports/${report.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        ↓ PDF
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Report Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Report</h2>

            {/* Report type selector */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">Report Type</label>
              <div className="space-y-2">
                {Object.entries(REPORT_TYPES).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => setNewType(type as NewType)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                      newType === type ? "border-[#1e3a8a] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {config.icon} {config.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Report title */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 block mb-1">Report Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Annual E-Lighting Inspection 2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewModal(false);
                  setNewTitle("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
                className="flex-1 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
