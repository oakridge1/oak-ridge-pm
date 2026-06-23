import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";

// ── Constants ───────────────────────────────────────────────────────────────
const NAVY = "#002D72";
const ORANGE = "#FF5910";
const LIGHT_GRAY = "#f8f9fa";
const MID_GRAY = "#e5e7eb";
const TEXT = "#1a1a2e";

const COMPANY_NAME = "Oak Ridge Electrical LLC";
const COMPANY_ADDRESS = "209 W. River Rd, Hooksett, NH 03106";
const COMPANY_LICENSE = "NH Electrical License #15117";

// ── Shared types ──────────────────────────────────────────────────────────────
export interface ReportJobInfo {
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
}

interface FindingRow {
  id: string;
  title: string;
  body: string;
  necReferences: string;
  hazardNote: string;
}

interface FixtureRow {
  id: string;
  location: string;
  fixtureTag: string;
  fixtureType: string;
  test30sec: string;
  test90min: string;
  visualPass: string;
  issueCodes: string[];
  notes: string;
}

interface SummaryRowT {
  id: string;
  necArticle: string;
  requirement: string;
  status: string;
}

export interface FullReport {
  certNumber: string | null;
  title: string;
  reportType: string;
  status: string;
  background: string;
  correctiveAction: string;
  closingParagraph: string;
  inspectorName: string;
  inspectionDate: Date | string | null;
  nextInspectionDate: Date | string | null;
  overallResult: string | null;
  projectInfo: unknown;
  analysisSections: unknown;
  findings: FindingRow[];
  fixtures: FixtureRow[];
  summaryRows: SummaryRowT[];
}

export interface IssueCodeType {
  code: string;
  description: string;
  correctiveCode: string;
  correctiveDescription: string;
}

const longDate = (d: Date | string | null | undefined): string =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

// ── Shared styles ─────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: TEXT,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40 },
  footerRule: { borderTopWidth: 1.5, borderTopColor: ORANGE, marginBottom: 4 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#888" },
  sectionHeader: {
    backgroundColor: NAVY,
    color: "#ffffff",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 14,
    marginBottom: 8,
  },
  orangeRuleHeader: { borderBottomWidth: 2, borderBottomColor: ORANGE, paddingBottom: 4, marginBottom: 8 },
  orangeRuleTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 0.5, borderColor: MID_GRAY, marginBottom: 16 },
  infoCell: { width: "25%", borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: MID_GRAY, padding: 6 },
  infoCellWide: { width: "50%" },
  infoLabel: {
    fontSize: 7,
    color: "#888",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: TEXT },
  findingCard: {
    borderLeftWidth: 4,
    borderLeftColor: ORANGE,
    backgroundColor: "#fffbf7",
    padding: 10,
    marginBottom: 10,
    borderRadius: 2,
  },
  findingLabel: {
    fontSize: 8,
    color: ORANGE,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  findingTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: TEXT, marginBottom: 6 },
  findingBody: { fontSize: 9, color: TEXT, lineHeight: 1.5, marginBottom: 6, textAlign: "justify" },
  hazardNote: { fontSize: 8, fontStyle: "italic", color: "#b45309", marginBottom: 4 },
  necRef: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY },
  tableHeader: { flexDirection: "row", backgroundColor: NAVY },
  tableHeaderCell: { color: "#ffffff", fontSize: 8, fontFamily: "Helvetica-Bold", padding: 5 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: MID_GRAY },
  tableRowAlt: { backgroundColor: LIGHT_GRAY },
  tableCell: { fontSize: 8, padding: 5, color: TEXT },
});

// ── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <View style={S.footer} fixed>
      <View style={S.footerRule} />
      <View style={S.footerRow}>
        <Text style={S.footerText}>
          {COMPANY_NAME} · {COMPANY_ADDRESS} · {COMPANY_LICENSE}
        </Text>
        <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </View>
  );
}

// ── InfoCell helper ───────────────────────────────────────────────────────────
function InfoCell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={wide ? [S.infoCell, S.infoCellWide] : S.infoCell}>
      <Text style={S.infoLabel}>{label}</Text>
      <Text style={S.infoValue}>{value}</Text>
    </View>
  );
}

const statusLabel = (status: string) => (status === "NOT_MET" ? "NOT MET" : status === "NA" ? "N/A" : status);
const statusColor = (status: string) =>
  status === "NOT_MET" ? "#dc2626" : status === "MET" ? "#16a34a" : status === "PENDING" ? "#d97706" : "#888";

// ── Field Investigation ───────────────────────────────────────────────────────
export function FieldInvestigationDoc({
  report,
  job,
  logoSrc,
}: {
  report: FullReport;
  job: ReportJobInfo;
  logoSrc?: string;
}) {
  const reportDate = longDate(report.inspectionDate ?? new Date());
  const projectInfo = (report.projectInfo as Record<string, string>) || {};
  const analysisSections = Array.isArray(report.analysisSections)
    ? (report.analysisSections as Array<{ subtitle: string; body: string }>)
    : [];

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        <Footer />

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          {logoSrc ? <Image src={logoSrc} style={{ width: 80, marginRight: 16 }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.5 }}>
              FIELD INVESTIGATION REPORT
            </Text>
            <Text style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{report.title}</Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 2, borderBottomColor: ORANGE, marginBottom: 12 }} />

        {/* Project info grid */}
        <View style={S.infoGrid}>
          <InfoCell
            label="Project / Job Site"
            value={`${job.jobName}\n${[job.address, job.city, job.state].filter(Boolean).join(", ")}`}
          />
          <InfoCell label="Client / Owner" value={job.ownerName || "—"} />
          <InfoCell label="General Contractor" value={[job.gcCompany, job.gcContactName, job.gcPhone].filter(Boolean).join("\n") || "—"} />
          <InfoCell label="Report Date" value={reportDate} />
          <InfoCell label="Prepared By" value={`${COMPANY_NAME}\n${COMPANY_ADDRESS}`} />
          <InfoCell label="NH Electrical License" value="#15117" />
          <InfoCell label="Report Type" value={projectInfo.reportTypeLabel || "Field Investigation / Code Compliance"} wide />
        </View>

        {/* Background */}
        {report.background ? (
          <View style={{ marginBottom: 14 }}>
            <View style={S.orangeRuleHeader}>
              <Text style={S.orangeRuleTitle}>BACKGROUND</Text>
            </View>
            <Text style={{ fontSize: 9, lineHeight: 1.6, color: TEXT, textAlign: "justify" }}>{report.background}</Text>
          </View>
        ) : null}

        {/* Observed Conditions */}
        {report.findings.length > 0 ? (
          <View>
            <View style={S.sectionHeader}>
              <Text>OBSERVED CONDITIONS</Text>
            </View>
            {report.findings.map((finding, idx) => (
              <View key={finding.id} style={S.findingCard} wrap={false}>
                <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap" }}>
                  <Text style={{ fontSize: 8, color: ORANGE, fontFamily: "Helvetica-Bold", marginRight: 6 }}>
                    Finding {idx + 1}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: TEXT }}>{finding.title}</Text>
                </View>
                <Text style={S.findingBody}>{finding.body}</Text>
                {finding.hazardNote ? <Text style={S.hazardNote}>Hazard: {finding.hazardNote}</Text> : null}
                {finding.necReferences ? (
                  <Text style={S.necRef}>
                    NEC Reference:{" "}
                    <Text style={{ fontFamily: "Helvetica" }}>{finding.necReferences}</Text>
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Code & Safety Analysis */}
        {analysisSections.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <View style={S.orangeRuleHeader}>
              <Text style={S.orangeRuleTitle}>CODE AND SAFETY ANALYSIS</Text>
            </View>
            {analysisSections.map((s, i) => (
              <View key={i} style={{ marginBottom: 8 }} wrap={false}>
                {s.subtitle ? (
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: TEXT, marginBottom: 3 }}>{s.subtitle}</Text>
                ) : null}
                <Text style={{ fontSize: 9, lineHeight: 1.5, color: TEXT, textAlign: "justify" }}>{s.body}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Corrective Action */}
        {report.correctiveAction ? (
          <View style={{ marginTop: 8 }}>
            <View style={S.orangeRuleHeader}>
              <Text style={S.orangeRuleTitle}>RECOMMENDED CORRECTIVE ACTION</Text>
            </View>
            <Text style={{ fontSize: 9, lineHeight: 1.5, color: TEXT }}>{report.correctiveAction}</Text>
          </View>
        ) : null}

        {/* Summary table */}
        {report.summaryRows.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <View style={S.orangeRuleHeader}>
              <Text style={S.orangeRuleTitle}>SUMMARY</Text>
            </View>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { width: "25%" }]}>NEC Article</Text>
              <Text style={[S.tableHeaderCell, { flex: 1 }]}>Requirement</Text>
              <Text style={[S.tableHeaderCell, { width: "18%", textAlign: "center" }]}>Status</Text>
            </View>
            {report.summaryRows.map((row, idx) => (
              <View key={row.id} style={idx % 2 === 1 ? [S.tableRow, S.tableRowAlt] : S.tableRow}>
                <Text style={[S.tableCell, { width: "25%" }]}>{row.necArticle}</Text>
                <Text style={[S.tableCell, { flex: 1 }]}>{row.requirement}</Text>
                <Text
                  style={[
                    S.tableCell,
                    {
                      width: "18%",
                      textAlign: "center",
                      fontFamily: row.status === "NOT_MET" ? "Helvetica-Bold" : "Helvetica",
                      color: statusColor(row.status),
                    },
                  ]}
                >
                  {statusLabel(row.status)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Closing */}
        {report.closingParagraph ? (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 9, lineHeight: 1.6, color: TEXT, textAlign: "justify" }}>{report.closingParagraph}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

// ── Emergency Lighting ────────────────────────────────────────────────────────
export function EmergencyLightingDoc({
  report,
  job,
  issueCodes,
  logoSrc,
}: {
  report: FullReport;
  job: ReportJobInfo;
  issueCodes: IssueCodeType[];
  logoSrc?: string;
}) {
  const resultColor =
    report.overallResult === "PASS" ? "#16a34a" : report.overallResult === "FAIL" ? "#dc2626" : "#d97706";

  const usedCodes = [...new Set(report.fixtures.flatMap((f) => f.issueCodes))].sort();
  const inspectionDate = longDate(report.inspectionDate);
  const nextDate = longDate(report.nextInspectionDate);

  const fixtureTypeLabel = (t: string) =>
    t === "EMERGENCY_LIGHT" ? "EM Light" : t === "EXIT_SIGN" ? "Exit Sign" : "Combo";

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        <Footer />

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          {logoSrc ? <Image src={logoSrc} style={{ width: 70, marginRight: 14 }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY }}>EMERGENCY LIGHTING</Text>
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY }}>INSPECTION CERTIFICATE</Text>
            <Text style={{ fontSize: 8, color: ORANGE, marginTop: 2, fontFamily: "Helvetica-Bold" }}>
              NFPA 101 · Life Safety Code · Annual Inspection
            </Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: NAVY, padding: 8, alignItems: "center", minWidth: 90 }}>
            <Text style={{ fontSize: 7, color: "#888", marginBottom: 2 }}>CERTIFICATE NO.</Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>{report.certNumber || "—"}</Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 2, borderBottomColor: ORANGE, marginBottom: 12 }} />

        {/* Project info grid */}
        <View style={S.infoGrid}>
          <InfoCell
            label="Job Site / Facility"
            value={`${job.jobName}\n${[job.address, job.city, job.state].filter(Boolean).join(", ")}`}
          />
          <InfoCell label="Client / Owner" value={job.ownerName || "—"} />
          <InfoCell label="Inspection Date" value={inspectionDate} />
          <InfoCell label="Next Inspection Due" value={nextDate} />
          <InfoCell label="Inspector / Company" value={`${report.inspectorName || COMPANY_NAME}\n${COMPANY_ADDRESS}`} />
          <InfoCell label="License" value={COMPANY_LICENSE} />
          <InfoCell label="Overall Result" value={report.overallResult || "—"} wide />
        </View>

        {/* Overall result banner */}
        {report.overallResult ? (
          <View style={{ backgroundColor: resultColor, padding: 12, alignItems: "center", marginBottom: 14, borderRadius: 4 }}>
            <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 2 }}>
              {report.overallResult}
            </Text>
            <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
              Annual Emergency Lighting Inspection Result
            </Text>
          </View>
        ) : null}

        {/* Fixture table */}
        {report.fixtures.length > 0 ? (
          <View>
            <View style={S.sectionHeader}>
              <Text>FIXTURE INSPECTION LOG</Text>
            </View>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { width: "6%" }]}>#</Text>
              <Text style={[S.tableHeaderCell, { width: "10%" }]}>TAG</Text>
              <Text style={[S.tableHeaderCell, { flex: 1 }]}>LOCATION</Text>
              <Text style={[S.tableHeaderCell, { width: "12%" }]}>TYPE</Text>
              <Text style={[S.tableHeaderCell, { width: "8%", textAlign: "center" }]}>30 SEC</Text>
              <Text style={[S.tableHeaderCell, { width: "8%", textAlign: "center" }]}>90 MIN</Text>
              <Text style={[S.tableHeaderCell, { width: "8%", textAlign: "center" }]}>VISUAL</Text>
              <Text style={[S.tableHeaderCell, { width: "14%" }]}>CODES</Text>
              <Text style={[S.tableHeaderCell, { width: "18%" }]}>NOTES</Text>
            </View>
            {report.fixtures.map((f, idx) => {
              const codes = f.issueCodes.join(", ");
              const anyFail = f.test30sec === "FAIL" || f.test90min === "FAIL" || f.visualPass === "FAIL";
              const rowStyle = [S.tableRow, ...(idx % 2 === 1 ? [S.tableRowAlt] : []), ...(anyFail ? [{ backgroundColor: "#fff5f5" }] : [])];
              return (
                <View key={f.id} style={rowStyle}>
                  <Text style={[S.tableCell, { width: "6%", color: "#888" }]}>{idx + 1}</Text>
                  <Text style={[S.tableCell, { width: "10%", fontFamily: "Helvetica-Bold" }]}>{f.fixtureTag}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{f.location}</Text>
                  <Text style={[S.tableCell, { width: "12%" }]}>{fixtureTypeLabel(f.fixtureType)}</Text>
                  {[f.test30sec, f.test90min, f.visualPass].map((result, ri) => (
                    <Text
                      key={ri}
                      style={[
                        S.tableCell,
                        {
                          width: "8%",
                          textAlign: "center",
                          fontFamily: result === "FAIL" ? "Helvetica-Bold" : "Helvetica",
                          color: result === "PASS" ? "#16a34a" : result === "FAIL" ? "#dc2626" : "#aaa",
                        },
                      ]}
                    >
                      {result === "NOT_TESTED" ? "—" : result}
                    </Text>
                  ))}
                  <Text
                    style={[
                      S.tableCell,
                      { width: "14%", fontFamily: codes ? "Helvetica-Bold" : "Helvetica", color: codes ? ORANGE : "#aaa" },
                    ]}
                  >
                    {codes || "—"}
                  </Text>
                  <Text style={[S.tableCell, { width: "18%" }]}>{f.notes || ""}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Issue code legend */}
        {usedCodes.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <View style={S.sectionHeader}>
              <Text>ISSUE CODE LEGEND</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {usedCodes.map((code) => {
                const ic = issueCodes.find((i) => i.code === code);
                if (!ic) return null;
                return (
                  <View key={code} style={{ width: "50%", flexDirection: "row", alignItems: "flex-start", padding: 4, marginBottom: 2 }}>
                    <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY, width: 24, fontSize: 8 }}>{ic.code}</Text>
                    <Text style={{ fontSize: 8, color: TEXT, flex: 1 }}>
                      {ic.description}
                      {" → "}
                      <Text style={{ fontFamily: "Helvetica-Bold", color: ORANGE }}>{ic.correctiveCode}</Text> {ic.correctiveDescription}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Summary table */}
        {report.summaryRows.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <View style={S.sectionHeader}>
              <Text>SUMMARY</Text>
            </View>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { width: "25%" }]}>Code Reference</Text>
              <Text style={[S.tableHeaderCell, { flex: 1 }]}>Requirement</Text>
              <Text style={[S.tableHeaderCell, { width: "18%", textAlign: "center" }]}>Status</Text>
            </View>
            {report.summaryRows.map((row, idx) => (
              <View key={row.id} style={idx % 2 === 1 ? [S.tableRow, S.tableRowAlt] : S.tableRow}>
                <Text style={[S.tableCell, { width: "25%" }]}>{row.necArticle}</Text>
                <Text style={[S.tableCell, { flex: 1 }]}>{row.requirement}</Text>
                <Text
                  style={[
                    S.tableCell,
                    {
                      width: "18%",
                      textAlign: "center",
                      fontFamily: row.status === "NOT_MET" ? "Helvetica-Bold" : "Helvetica",
                      color: statusColor(row.status),
                    },
                  ]}
                >
                  {statusLabel(row.status)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Closing / signature */}
        <View style={{ marginTop: 24, borderTopWidth: 0.5, borderTopColor: MID_GRAY, paddingTop: 12 }}>
          {report.closingParagraph ? (
            <Text style={{ fontSize: 8, color: "#555", lineHeight: 1.5, marginBottom: 16 }}>{report.closingParagraph}</Text>
          ) : null}
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <View style={{ flex: 1, marginRight: 40 }}>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#888", marginBottom: 3, height: 20 }} />
              <Text style={{ fontSize: 7, color: "#888" }}>Inspector Signature</Text>
            </View>
            <View style={{ flex: 1, marginRight: 40 }}>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#888", marginBottom: 3, height: 20 }} />
              <Text style={{ fontSize: 7, color: "#888" }}>Date</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#888", marginBottom: 3, height: 20 }} />
              <Text style={{ fontSize: 7, color: "#888" }}>License Number</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
