"use client";

import { useState, useEffect } from "react";

// ── Types ───────────────────────────────────────────────────────────────────
interface Finding {
  id: string;
  sortOrder: number;
  title: string;
  body: string;
  necReferences: string;
  hazardNote: string;
  libraryFindingId: string | null;
}

interface Fixture {
  id: string;
  sortOrder: number;
  location: string;
  fixtureTag: string;
  fixtureType: "EMERGENCY_LIGHT" | "EXIT_SIGN" | "COMBO";
  test30sec: "PASS" | "FAIL" | "NOT_TESTED";
  test90min: "PASS" | "FAIL" | "NOT_TESTED";
  visualPass: "PASS" | "FAIL" | "NOT_TESTED";
  issueCodes: string[];
  notes: string;
}

interface SummaryRow {
  id: string;
  sortOrder: number;
  necArticle: string;
  requirement: string;
  status: "NOT_MET" | "PENDING" | "MET" | "NA";
}

interface AnalysisSection {
  id: string;
  subtitle: string;
  body: string;
}

interface IssueCodeType {
  id: string;
  code: string;
  description: string;
  correctiveCode: string;
  correctiveDescription: string;
  category: string;
}

interface LibraryFindingType {
  id: string;
  title: string;
  body: string;
  necReferences: string;
  hazardNote: string;
  tags: string[];
  reportType: string;
}

interface ReportEditorProps {
  report: {
    id: string;
    reportType: string;
    title: string;
    status: string;
    certNumber: string | null;
    background: string;
    correctiveAction: string;
    closingParagraph: string;
    inspectorName: string;
    inspectionDate: Date | string | null;
    nextInspectionDate: Date | string | null;
    overallResult: string | null;
    analysisSections: unknown;
    findings: Finding[];
    fixtures: Fixture[];
    summaryRows: SummaryRow[];
    job: {
      id: string;
      jobNumber: string;
      jobName: string;
      gcCompany: string | null;
      gcContactName: string | null;
      gcPhone: string | null;
      ownerName: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    };
  };
  libraryFindings: LibraryFindingType[];
  issueCodes: IssueCodeType[];
}

export function ReportEditor({ report, libraryFindings, issueCodes }: ReportEditorProps) {
  const apiBase = `/api/jobs/${report.job.id}/reports/${report.id}`;

  // Core report fields
  const [title, setTitle] = useState(report.title);
  const [background, setBackground] = useState(report.background);
  const [correctiveAction, setCorrectiveAction] = useState(report.correctiveAction);
  const [closingParagraph, setClosingParagraph] = useState(report.closingParagraph);
  const [inspectorName, setInspectorName] = useState(report.inspectorName);
  const [inspectionDate, setInspectionDate] = useState(
    report.inspectionDate
      ? new Date(report.inspectionDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [nextInspectionDate, setNextInspectionDate] = useState(
    report.nextInspectionDate
      ? new Date(report.nextInspectionDate).toISOString().split("T")[0]
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [overallResult, setOverallResult] = useState<"PASS" | "FAIL" | "CONDITIONAL" | null>(
    (report.overallResult as "PASS" | "FAIL" | "CONDITIONAL" | null) || null
  );
  const [status, setStatus] = useState(report.status);

  const [findings, setFindings] = useState<Finding[]>(report.findings);
  const [fixtures, setFixtures] = useState<Fixture[]>(report.fixtures);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>(report.summaryRows);
  const [analysisSections, setAnalysisSections] = useState<AnalysisSection[]>(
    Array.isArray(report.analysisSections) ? (report.analysisSections as AnalysisSection[]) : []
  );

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  // ── handleSave ──
  const handleSave = async (markFinal = false) => {
    setSaving(true);
    try {
      await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          background,
          correctiveAction,
          closingParagraph,
          inspectorName,
          inspectionDate,
          nextInspectionDate,
          overallResult,
          analysisSections,
          status: markFinal ? "FINAL" : undefined,
        }),
      });
      setSaved(true);
      if (markFinal) setStatus("FINAL");
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  // ── Auto-save (debounced 2s) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSave(false);
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    background,
    correctiveAction,
    closingParagraph,
    inspectorName,
    inspectionDate,
    nextInspectionDate,
    overallResult,
    analysisSections,
  ]);

  // ── Finding handlers ──
  const addFinding = async (fromLibrary?: LibraryFindingType) => {
    const res = await fetch(`${apiBase}/findings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fromLibrary?.title || "",
        body: fromLibrary?.body || "",
        necReferences: fromLibrary?.necReferences || "",
        hazardNote: fromLibrary?.hazardNote || "",
        libraryFindingId: fromLibrary?.id || null,
        sortOrder: findings.length,
      }),
    });
    const { finding } = await res.json();
    setFindings((prev) => [...prev, finding]);
    setShowLibrary(false);
    setLibrarySearch("");
  };

  const updateFinding = async (id: string, field: keyof Finding, value: string) => {
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
    await fetch(`${apiBase}/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  };

  const removeFinding = async (id: string) => {
    if (!confirm("Remove this finding?")) return;
    await fetch(`${apiBase}/findings/${id}`, { method: "DELETE" });
    setFindings((prev) => prev.filter((f) => f.id !== id));
  };

  // ── Fixture handlers ──
  const addFixture = async () => {
    const res = await fetch(`${apiBase}/fixtures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "",
        fixtureTag: `EL-${String(fixtures.length + 1).padStart(2, "0")}`,
        fixtureType: "EMERGENCY_LIGHT",
        sortOrder: fixtures.length,
      }),
    });
    const { fixture } = await res.json();
    setFixtures((prev) => [...prev, fixture]);
  };

  const updateFixture = async (id: string, patch: Partial<Fixture>) => {
    setFixtures((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    await fetch(`${apiBase}/fixtures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const removeFixture = async (id: string) => {
    if (!confirm("Remove this fixture?")) return;
    await fetch(`${apiBase}/fixtures/${id}`, { method: "DELETE" });
    setFixtures((prev) => prev.filter((f) => f.id !== id));
  };

  // ── Summary row handlers ──
  const addSummaryRow = async () => {
    const res = await fetch(`${apiBase}/summary-rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        necArticle: "",
        requirement: "",
        status: "NOT_MET",
        sortOrder: summaryRows.length,
      }),
    });
    const { row } = await res.json();
    setSummaryRows((prev) => [...prev, row]);
  };

  const updateSummaryRow = async (id: string, patch: Partial<SummaryRow>) => {
    setSummaryRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await fetch(`${apiBase}/summary-rows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const removeSummaryRow = async (id: string) => {
    await fetch(`${apiBase}/summary-rows/${id}`, { method: "DELETE" });
    setSummaryRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href={`/jobs/${report.job.id}?tab=reports`}
              className="text-gray-400 hover:text-gray-600 text-sm whitespace-nowrap"
            >
              ← {report.job.jobName}
            </a>
            <span className="text-gray-300">/</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-semibold text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded text-lg min-w-0 flex-1"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                status === "FINAL" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {status === "FINAL" ? "Final" : "Draft"}
            </span>
            {saved && <span className="text-xs text-gray-400">✓ Saved</span>}
            {saving && <span className="text-xs text-gray-400">Saving...</span>}
            {status === "DRAFT" && (
              <button
                onClick={() => handleSave(true)}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
              >
                Mark as Final
              </button>
            )}
            <a
              href={`${apiBase}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 bg-[#1e3a8a] text-white rounded-lg text-sm font-semibold hover:bg-blue-800"
            >
              ↓ Download PDF
            </a>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Project info */}
        <SectionCard title="Project Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Inspector" value={inspectorName} onChange={setInspectorName} placeholder="Oak Ridge Electrical LLC" />
            <Field label="Inspection Date" type="date" value={inspectionDate} onChange={setInspectionDate} />
            <Field label="Job Site" value={report.job.jobName} readOnly />
            <Field
              label="Address"
              value={[report.job.address, report.job.city, report.job.state].filter(Boolean).join(", ")}
              readOnly
            />
            <Field label="Client / Owner" value={report.job.ownerName || ""} readOnly />
            <Field
              label="General Contractor"
              value={[report.job.gcCompany, report.job.gcContactName, report.job.gcPhone].filter(Boolean).join(" — ")}
              readOnly
            />
            {report.reportType === "EMERGENCY_LIGHTING" && (
              <Field label="Next Inspection Due" type="date" value={nextInspectionDate} onChange={setNextInspectionDate} />
            )}
            <Field label="Cert #" value={report.certNumber || ""} readOnly />
          </div>
        </SectionCard>

        {/* ── Field Investigation ── */}
        {report.reportType === "FIELD_INVESTIGATION" && (
          <>
            <SectionCard title="Background">
              <textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                rows={4}
                placeholder="Describe why this investigation was conducted..."
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </SectionCard>

            <SectionCard
              title="Observed Conditions"
              action={
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLibrary(true)}
                    className="px-3 py-1.5 text-xs border border-[#1e3a8a] text-[#1e3a8a] rounded-lg hover:bg-blue-50"
                  >
                    + From Library
                  </button>
                  <button
                    onClick={() => addFinding()}
                    className="px-3 py-1.5 text-xs bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800"
                  >
                    + Add Finding
                  </button>
                </div>
              }
            >
              {findings.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No findings yet. Add a finding or search the library.
                </div>
              )}

              <div className="space-y-4">
                {findings.map((finding, idx) => (
                  <div key={finding.id} className="border-l-4 border-[#FF5910] bg-orange-50 rounded-r-lg p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[#FF5910] uppercase tracking-wide">Finding {idx + 1}</span>
                      <button onClick={() => removeFinding(finding.id)} className="text-gray-300 hover:text-red-400 text-sm">
                        ✕
                      </button>
                    </div>

                    <input
                      value={finding.title}
                      onChange={(e) => updateFinding(finding.id, "title", e.target.value)}
                      placeholder="Finding title..."
                      className="w-full font-semibold text-gray-900 bg-white border rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
                    />

                    <textarea
                      value={finding.body}
                      onChange={(e) => updateFinding(finding.id, "body", e.target.value)}
                      placeholder="Describe the observed condition..."
                      rows={4}
                      className="w-full bg-white border rounded px-2 py-1 text-sm resize-none mb-2 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
                    />

                    <div className="mb-2">
                      <label className="text-xs font-medium text-amber-700 block mb-1">Hazard Note (optional)</label>
                      <input
                        value={finding.hazardNote}
                        onChange={(e) => updateFinding(finding.id, "hazardNote", e.target.value)}
                        placeholder="Describe the hazard..."
                        className="w-full bg-white border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 italic"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#1e3a8a] block mb-1">NEC References</label>
                      <input
                        value={finding.necReferences}
                        onChange={(e) => updateFinding(finding.id, "necReferences", e.target.value)}
                        placeholder="e.g. NEC 110.12; NEC 300.15"
                        className="w-full bg-white border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Code & Safety Analysis"
              action={
                <button
                  onClick={() =>
                    setAnalysisSections((prev) => [...prev, { id: crypto.randomUUID(), subtitle: "", body: "" }])
                  }
                  className="px-3 py-1.5 text-xs bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800"
                >
                  + Add Section
                </button>
              }
            >
              <div className="space-y-4">
                {analysisSections.map((section, idx) => (
                  <div key={section.id}>
                    <input
                      value={section.subtitle}
                      onChange={(e) => {
                        const updated = [...analysisSections];
                        updated[idx] = { ...updated[idx], subtitle: e.target.value };
                        setAnalysisSections(updated);
                      }}
                      placeholder="Section title..."
                      className="w-full font-semibold border-b border-gray-200 pb-1 mb-2 text-sm focus:outline-none focus:border-[#1e3a8a] bg-transparent"
                    />
                    <textarea
                      value={section.body}
                      onChange={(e) => {
                        const updated = [...analysisSections];
                        updated[idx] = { ...updated[idx], body: e.target.value };
                        setAnalysisSections(updated);
                      }}
                      rows={3}
                      placeholder="Analysis text..."
                      className="w-full border rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
                    />
                  </div>
                ))}
                {analysisSections.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Add analysis sections above.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Recommended Corrective Action">
              <textarea
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                rows={5}
                placeholder="Describe recommended corrective actions..."
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </SectionCard>
          </>
        )}

        {/* ── Emergency Lighting ── */}
        {report.reportType === "EMERGENCY_LIGHTING" && (
          <>
            <SectionCard title="Inspection Result">
              <div className="flex gap-3">
                {(["PASS", "FAIL", "CONDITIONAL"] as const).map((result) => (
                  <button
                    key={result}
                    onClick={() => setOverallResult(result)}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm border-2 transition-colors ${
                      overallResult === result
                        ? result === "PASS"
                          ? "bg-green-500 text-white border-green-500"
                          : result === "FAIL"
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-amber-500 text-white border-amber-500"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {result}
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Fixture Inspection Log"
              action={
                <button onClick={addFixture} className="px-3 py-1.5 text-xs bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800">
                  + Add Fixture
                </button>
              }
            >
              {fixtures.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">No fixtures yet. Click &quot;+ Add Fixture&quot; to begin.</div>
              )}

              {fixtures.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1e3a8a] text-white text-xs">
                        <th className="px-3 py-2 text-left w-8">#</th>
                        <th className="px-3 py-2 text-left">Tag</th>
                        <th className="px-3 py-2 text-left">Location</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-center">30s</th>
                        <th className="px-3 py-2 text-center">90m</th>
                        <th className="px-3 py-2 text-center">Visual</th>
                        <th className="px-3 py-2 text-left">Codes</th>
                        <th className="px-3 py-2 text-left">Notes</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixtures.map((f, idx) => (
                        <tr key={f.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <input
                              value={f.fixtureTag}
                              onChange={(e) => updateFixture(f.id, { fixtureTag: e.target.value })}
                              className="w-16 border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={f.location}
                              onChange={(e) => updateFixture(f.id, { location: e.target.value })}
                              placeholder="Location..."
                              className="w-full border rounded px-1 py-0.5 text-xs min-w-[120px] focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={f.fixtureType}
                              onChange={(e) => updateFixture(f.id, { fixtureType: e.target.value as Fixture["fixtureType"] })}
                              className="border rounded px-1 py-0.5 text-xs focus:outline-none"
                            >
                              <option value="EMERGENCY_LIGHT">EM Light</option>
                              <option value="EXIT_SIGN">Exit Sign</option>
                              <option value="COMBO">Combo</option>
                            </select>
                          </td>
                          {(["test30sec", "test90min", "visualPass"] as const).map((field) => (
                            <td key={field} className="px-3 py-2 text-center">
                              <select
                                value={f[field]}
                                onChange={(e) => updateFixture(f.id, { [field]: e.target.value as Fixture["test30sec"] })}
                                className={`border rounded px-1 py-0.5 text-xs font-medium focus:outline-none ${
                                  f[field] === "PASS"
                                    ? "text-green-600 border-green-200"
                                    : f[field] === "FAIL"
                                    ? "text-red-600 border-red-200"
                                    : "text-gray-400"
                                }`}
                              >
                                <option value="NOT_TESTED">—</option>
                                <option value="PASS">PASS</option>
                                <option value="FAIL">FAIL</option>
                              </select>
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <IssueCodePicker
                              value={f.issueCodes}
                              issueCodes={issueCodes}
                              onChange={(codes) => updateFixture(f.id, { issueCodes: codes })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={f.notes}
                              onChange={(e) => updateFixture(f.id, { notes: e.target.value })}
                              placeholder="Notes..."
                              className="w-full border rounded px-1 py-0.5 text-xs min-w-[80px] focus:outline-none"
                            />
                          </td>
                          <td className="px-2">
                            <button onClick={() => removeFixture(f.id)} className="text-gray-300 hover:text-red-400 text-xs">
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {fixtures.some((f) => f.issueCodes.length > 0) && (
              <SectionCard title="Issue Code Legend">
                <div className="grid grid-cols-2 gap-2">
                  {[...new Set(fixtures.flatMap((f) => f.issueCodes))].sort().map((code) => {
                    const ic = issueCodes.find((i) => i.code === code);
                    if (!ic) return null;
                    return (
                      <div key={code} className="flex gap-2 text-sm">
                        <span className="font-mono font-bold text-[#1e3a8a] w-8">{ic.code}</span>
                        <span className="text-gray-600">{ic.description}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-mono text-[#FF5910] w-8">{ic.correctiveCode}</span>
                        <span className="text-gray-600">{ic.correctiveDescription}</span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </>
        )}

        {/* ── Summary table (both types) ── */}
        <SectionCard
          title="Summary"
          action={
            <button onClick={addSummaryRow} className="px-3 py-1.5 text-xs bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-800">
              + Add Row
            </button>
          }
        >
          {summaryRows.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Add summary rows above.</p>}
          {summaryRows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1e3a8a] text-white text-xs">
                  <th className="px-3 py-2 text-left">NEC Article</th>
                  <th className="px-3 py-2 text-left">Requirement</th>
                  <th className="px-3 py-2 text-center w-32">Status</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, idx) => (
                  <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2">
                      <input
                        value={row.necArticle}
                        onChange={(e) => updateSummaryRow(row.id, { necArticle: e.target.value })}
                        placeholder="NEC 110.12"
                        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.requirement}
                        onChange={(e) => updateSummaryRow(row.id, { requirement: e.target.value })}
                        placeholder="Requirement..."
                        className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.status}
                        onChange={(e) => updateSummaryRow(row.id, { status: e.target.value as SummaryRow["status"] })}
                        className={`w-full border rounded px-1 py-0.5 text-xs font-bold focus:outline-none ${
                          row.status === "NOT_MET"
                            ? "text-red-600"
                            : row.status === "MET"
                            ? "text-green-600"
                            : row.status === "PENDING"
                            ? "text-amber-600"
                            : "text-gray-400"
                        }`}
                      >
                        <option value="NOT_MET">NOT MET</option>
                        <option value="PENDING">PENDING</option>
                        <option value="MET">MET</option>
                        <option value="NA">N/A</option>
                      </select>
                    </td>
                    <td className="px-2">
                      <button onClick={() => removeSummaryRow(row.id)} className="text-gray-300 hover:text-red-400 text-xs">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* ── Closing ── */}
        <SectionCard title="Closing Statement">
          <textarea
            value={closingParagraph}
            onChange={(e) => setClosingParagraph(e.target.value)}
            rows={3}
            placeholder="Closing statement..."
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </SectionCard>
      </div>

      {/* ── Library modal ── */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Findings Library</h2>
              <button
                onClick={() => {
                  setShowLibrary(false);
                  setLibrarySearch("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b">
              <input
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search by title, NEC article, or keyword..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {libraryFindings
                .filter((f) => f.reportType === report.reportType.toLowerCase() || librarySearch.length > 1)
                .filter((f) => {
                  if (!librarySearch) return true;
                  const q = librarySearch.toLowerCase();
                  return (
                    f.title.toLowerCase().includes(q) ||
                    f.necReferences.toLowerCase().includes(q) ||
                    f.tags.some((t) => t.toLowerCase().includes(q))
                  );
                })
                .map((f) => (
                  <div
                    key={f.id}
                    className="border rounded-lg p-3 hover:border-[#1e3a8a] hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => addFinding(f)}
                  >
                    <div className="font-semibold text-sm text-gray-900 mb-1">{f.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-2 mb-1">{f.body}</div>
                    {f.necReferences && <div className="text-xs text-[#1e3a8a] font-medium">{f.necReferences}</div>}
                  </div>
                ))}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => addFinding()}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#1e3a8a] hover:text-[#1e3a8a]"
              >
                + Add blank finding instead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────
function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  type,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      <input
        type={type || "text"}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] ${
          readOnly ? "bg-gray-50 text-gray-500 cursor-default" : "bg-white"
        }`}
      />
    </div>
  );
}

function IssueCodePicker({
  value,
  issueCodes,
  onChange,
}: {
  value: string[];
  issueCodes: IssueCodeType[];
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="border rounded px-1 py-0.5 text-xs min-w-[60px] text-left hover:border-gray-400"
      >
        {value.length > 0 ? value.join(", ") : "+ Code"}
      </button>
      {open && (
        <div className="absolute z-20 bg-white border rounded-lg shadow-lg p-2 min-w-[200px] max-h-48 overflow-y-auto left-0 top-full mt-1">
          {issueCodes.map((ic) => (
            <label key={ic.code} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs rounded">
              <input
                type="checkbox"
                checked={value.includes(ic.code)}
                onChange={(e) => {
                  const next = e.target.checked ? [...value, ic.code] : value.filter((c) => c !== ic.code);
                  onChange(next);
                }}
              />
              <span className="font-mono font-bold text-[#1e3a8a] w-8">{ic.code}</span>
              <span className="text-gray-600">{ic.description}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
