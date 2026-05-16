import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";

const NAVY = "#002D72";
const ORANGE = "#FF5910";
const GRAY = "#555555";
const LIGHT = "#999999";
const BORDER = "#e0e0e0";

const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtDate = (d: Date | string | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 40, color: "#1a1a1a" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 10,
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    borderBottomStyle: "solid",
  },
  brandLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: ORANGE },
  jobName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 3 },
  jobNum: { fontSize: 8, color: GRAY, fontFamily: "Courier", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  headerRightTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GRAY },
  headerRightDate: { fontSize: 8, color: LIGHT, marginTop: 2 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    paddingBottom: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: "solid",
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap" },
  infoCell: { width: "50%", flexDirection: "row", marginBottom: 4 },
  infoLabel: { width: 90, fontSize: 8, color: LIGHT },
  infoValue: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold" },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    borderBottomStyle: "solid",
    paddingBottom: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: "solid",
    paddingVertical: 4,
  },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: LIGHT },
  td: { fontSize: 9, color: "#1a1a1a" },
  tdGray: { fontSize: 9, color: GRAY },
  tdRight: { fontSize: 9, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: NAVY,
    borderTopStyle: "solid",
  },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right" },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: "solid",
  },
  noteItem: { marginBottom: 8 },
  noteMeta: { fontSize: 7, color: LIGHT, marginBottom: 2 },
  noteContent: { fontSize: 9, color: "#1a1a1a" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: "solid",
  },
  footerText: { fontSize: 7, color: LIGHT },
  balanceBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0f4ff",
    padding: 14,
    borderRadius: 6,
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 8, color: GRAY, marginBottom: 4 },
  balanceAmount: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY },
  balanceRight: { alignItems: "flex-end" },
  balanceRightText: { fontSize: 8, color: GRAY },
});

// ── Full Report ───────────────────────────────────────────────────────────────

export type FullReportData = {
  jobNumber: string;
  jobName: string;
  status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  gcCompany: string | null;
  gcContactName: string | null;
  permitNumber: string | null;
  contractStartDate: Date | string | null;
  completionDate: Date | string | null;
  scopeOfWork: string | null;
  foreman: { name: string | null } | null;
  laborEntries: Array<{ date: Date | string; hours: number; user: { name: string | null } }>;
  materials: Array<{ date: Date | string; vendor: string | null; description: string; amount: number }>;
  notes: Array<{ content: string; createdAt: Date | string; user: { name: string | null } }>;
  tasks: Array<{ title: string; status: string; assignee: { name: string | null } | null; dueDate: Date | string | null }>;
  payments: Array<{ date: Date | string; note: string | null; amount: number }>;
};

export function FullReportDoc({ data }: { data: FullReportData }) {
  const totalHours = data.laborEntries.reduce((s, e) => s + e.hours, 0);
  const totalMaterials = data.materials.reduce((s, m) => s + m.amount, 0);
  const totalPayments = data.payments.reduce((s, p) => s + p.amount, 0);
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const address = [data.address, data.city, data.state, data.zip].filter(Boolean).join(", ");

  const infoRows = ([
    ["Foreman", data.foreman?.name],
    ["Status", data.status],
    ["Address", address || null],
    ["Contract Start", data.contractStartDate ? fmtDate(data.contractStartDate) : null],
    ["Completion", data.completionDate ? fmtDate(data.completionDate) : null],
    ["GC Company", data.gcCompany],
    ["GC Contact", data.gcContactName],
    ["Permit #", data.permitNumber],
  ] as Array<[string, string | null | undefined]>).filter(([, v]) => v);

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        <View style={S.headerRow}>
          <View>
            <Text style={S.brandLabel}>OAK RIDGE ELECTRICAL LLC</Text>
            <Text style={S.jobName}>{data.jobName}</Text>
            <Text style={S.jobNum}>Job #{data.jobNumber}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerRightTitle}>Full Job Report</Text>
            <Text style={S.headerRightDate}>{today}</Text>
          </View>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>JOB INFORMATION</Text>
          <View style={S.infoGrid}>
            {infoRows.map(([label, value]) => (
              <View key={label} style={S.infoCell}>
                <Text style={S.infoLabel}>{label}</Text>
                <Text style={S.infoValue}>{value ?? ""}</Text>
              </View>
            ))}
          </View>
          {data.scopeOfWork ? (
            <View style={{ marginTop: 8 }}>
              <Text style={S.infoLabel}>Scope of Work</Text>
              <Text style={{ fontSize: 9, marginTop: 3 }}>{data.scopeOfWork}</Text>
            </View>
          ) : null}
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>LABOR — {totalHours.toFixed(1)} HRS TOTAL</Text>
          <View style={S.tableHeaderRow}>
            <Text style={[S.th, { width: 100 }]}>Date</Text>
            <Text style={[S.th, { flex: 1 }]}>Worker</Text>
            <Text style={[S.th, { width: 50, textAlign: "right" }]}>Hours</Text>
          </View>
          {data.laborEntries.map((e, i) => (
            <View key={i} style={S.tableRow}>
              <Text style={[S.tdGray, { width: 100 }]}>{fmtDate(e.date)}</Text>
              <Text style={[S.td, { flex: 1 }]}>{e.user.name ?? "—"}</Text>
              <Text style={[S.tdRight, { width: 50 }]}>{e.hours}</Text>
            </View>
          ))}
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>
            MATERIALS & EXPENSES — {fmt$(totalMaterials)} TOTAL
          </Text>
          <View style={S.tableHeaderRow}>
            <Text style={[S.th, { width: 80 }]}>Date</Text>
            <Text style={[S.th, { width: 100 }]}>Vendor</Text>
            <Text style={[S.th, { flex: 1 }]}>Description</Text>
            <Text style={[S.th, { width: 70, textAlign: "right" }]}>Amount</Text>
          </View>
          {data.materials.map((m, i) => (
            <View key={i} style={S.tableRow}>
              <Text style={[S.tdGray, { width: 80 }]}>{fmtDate(m.date)}</Text>
              <Text style={[S.tdGray, { width: 100 }]}>{m.vendor ?? "—"}</Text>
              <Text style={[S.td, { flex: 1 }]}>{m.description}</Text>
              <Text style={[S.tdRight, { width: 70 }]}>{fmt$(m.amount)}</Text>
            </View>
          ))}
        </View>

        {data.notes.length > 0 ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>NOTES</Text>
            {data.notes.map((n, i) => (
              <View key={i} style={S.noteItem}>
                <Text style={S.noteMeta}>
                  {n.user.name ?? "?"} · {fmtDate(n.createdAt)}
                </Text>
                <Text style={S.noteContent}>{n.content}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.tasks.length > 0 ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>TASKS</Text>
            <View style={S.tableHeaderRow}>
              <Text style={[S.th, { flex: 1 }]}>Task</Text>
              <Text style={[S.th, { width: 90 }]}>Assignee</Text>
              <Text style={[S.th, { width: 70 }]}>Status</Text>
              <Text style={[S.th, { width: 70, textAlign: "right" }]}>Due</Text>
            </View>
            {data.tasks.map((t, i) => (
              <View key={i} style={S.tableRow}>
                <Text style={[S.td, { flex: 1 }]}>{t.title}</Text>
                <Text style={[S.tdGray, { width: 90 }]}>{t.assignee?.name ?? "—"}</Text>
                <Text style={[S.tdGray, { width: 70 }]}>{t.status}</Text>
                <Text style={[S.tdGray, { width: 70, textAlign: "right" }]}>
                  {t.dueDate ? fmtDate(t.dueDate) : "—"}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.payments.length > 0 ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>
              PAYMENT HISTORY — {fmt$(totalPayments)} RECEIVED
            </Text>
            <View style={S.tableHeaderRow}>
              <Text style={[S.th, { width: 100 }]}>Date</Text>
              <Text style={[S.th, { flex: 1 }]}>Note</Text>
              <Text style={[S.th, { width: 80, textAlign: "right" }]}>Amount</Text>
            </View>
            {data.payments.map((p, i) => (
              <View key={i} style={S.tableRow}>
                <Text style={[S.tdGray, { width: 100 }]}>{fmtDate(p.date)}</Text>
                <Text style={[S.td, { flex: 1 }]}>{p.note ?? "—"}</Text>
                <Text style={[S.tdRight, { width: 80 }]}>{fmt$(p.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>Oak Ridge Electrical LLC — Confidential</Text>
          <Text style={S.footerText}>Generated {today}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Summary Report ────────────────────────────────────────────────────────────

type OtherCost = { id: string; description: string; amount: number };

export type SummaryData = {
  jobNumber: string;
  jobName: string;
  gcCompany: string | null;
  gcContactName: string | null;
  foreman: { name: string | null } | null;
  contractStartDate: Date | string | null;
  completionDate: Date | string | null;
  permitNumber: string | null;
  totalHours: number;
  laborCost: number | null;
  blendedLaborRate: number | null;
  materialsCost: number;
  subCost: number;
  subMarkupPct: number | null;
  equipCost: number;
  equipBillPct: number;
  equipmentMarkupPct: number | null;
  otherCosts: OtherCost[];
  laborMarkupPct: number | null;
  laborMarkup: number;
  subMarkup: number;
  equipMarkup: number;
  grossBilling: number;
  contractValue: number;
  approvedCOs: Array<{ description: string; approvedValue: number }>;
  revisedContract: number;
  payments: Array<{ date: Date | string; note: string | null; amount: number }>;
  totalBilled: number;
  balanceRemaining: number;
};

export function SummaryDoc({ data }: { data: SummaryData }) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const infoRows = ([
    ["Foreman", data.foreman?.name],
    ["GC Company", data.gcCompany],
    ["GC Contact", data.gcContactName],
    ["Contract Start", data.contractStartDate ? fmtDate(data.contractStartDate) : null],
    ["Completion", data.completionDate ? fmtDate(data.completionDate) : null],
    ["Permit #", data.permitNumber],
  ] as Array<[string, string | null | undefined]>).filter(([, v]) => v);

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        <View style={S.headerRow}>
          <View>
            <Text style={S.brandLabel}>OAK RIDGE ELECTRICAL LLC</Text>
            <Text style={S.jobName}>{data.jobName}</Text>
            <Text style={S.jobNum}>Job #{data.jobNumber}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerRightTitle}>Billing Summary</Text>
            <Text style={S.headerRightDate}>{today}</Text>
          </View>
        </View>

        {infoRows.length > 0 ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>PROJECT INFORMATION</Text>
            <View style={S.infoGrid}>
              {infoRows.map(([label, value]) => (
                <View key={label} style={S.infoCell}>
                  <Text style={S.infoLabel}>{label}</Text>
                  <Text style={S.infoValue}>{value ?? ""}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={S.section}>
          <Text style={S.sectionTitle}>COST BREAKDOWN</Text>

          <View style={S.tableRow}>
            <Text style={[S.td, { flex: 1 }]}>Labor</Text>
            <Text style={[S.tdGray, { width: 140 }]}>
              {data.totalHours.toFixed(1)} hrs
              {data.blendedLaborRate ? ` @ ${fmt$(data.blendedLaborRate)}/hr` : ""}
            </Text>
            <Text style={[S.td, { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
              {data.laborCost != null ? fmt$(data.laborCost) : "—"}
            </Text>
          </View>
          {data.laborMarkupPct != null && data.laborCost != null ? (
            <View style={S.tableRow}>
              <Text style={[S.tdGray, { flex: 1, paddingLeft: 12 }]}>Overhead & Profit</Text>
              <Text style={[S.tdGray, { width: 140 }]}>{data.laborMarkupPct}%</Text>
              <Text style={[S.tdGray, { width: 80, textAlign: "right" }]}>
                {fmt$(data.laborMarkup)}
              </Text>
            </View>
          ) : null}

          <View style={S.tableRow}>
            <Text style={[S.td, { flex: 1 }]}>Materials & Expenses</Text>
            <Text style={[S.tdGray, { width: 140 }]}></Text>
            <Text style={[S.td, { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
              {fmt$(data.materialsCost)}
            </Text>
          </View>

          {data.subCost > 0 ? (
            <>
              <View style={S.tableRow}>
                <Text style={[S.td, { flex: 1 }]}>Subcontractors</Text>
                <Text style={[S.tdGray, { width: 140 }]}></Text>
                <Text style={[S.td, { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                  {fmt$(data.subCost)}
                </Text>
              </View>
              {data.subMarkupPct != null && data.subMarkupPct > 0 ? (
                <View style={S.tableRow}>
                  <Text style={[S.tdGray, { flex: 1, paddingLeft: 12 }]}>Markup</Text>
                  <Text style={[S.tdGray, { width: 140 }]}>{data.subMarkupPct}%</Text>
                  <Text style={[S.tdGray, { width: 80, textAlign: "right" }]}>
                    {fmt$(data.subMarkup)}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {data.equipCost > 0 ? (
            <>
              <View style={S.tableRow}>
                <Text style={[S.td, { flex: 1 }]}>Equipment Rental</Text>
                <Text style={[S.tdGray, { width: 140 }]}>{data.equipBillPct}% billed</Text>
                <Text style={[S.td, { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                  {fmt$(data.equipCost)}
                </Text>
              </View>
              {data.equipmentMarkupPct != null && data.equipmentMarkupPct > 0 ? (
                <View style={S.tableRow}>
                  <Text style={[S.tdGray, { flex: 1, paddingLeft: 12 }]}>Markup</Text>
                  <Text style={[S.tdGray, { width: 140 }]}>{data.equipmentMarkupPct}%</Text>
                  <Text style={[S.tdGray, { width: 80, textAlign: "right" }]}>
                    {fmt$(data.equipMarkup)}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {data.otherCosts.map((oc) => (
            <View key={oc.id} style={S.tableRow}>
              <Text style={[S.td, { flex: 1 }]}>{oc.description}</Text>
              <Text style={[S.tdGray, { width: 140 }]}></Text>
              <Text style={[S.td, { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                {fmt$(oc.amount)}
              </Text>
            </View>
          ))}

          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Gross Billing Amount</Text>
            <Text style={S.totalValue}>{fmt$(data.grossBilling)}</Text>
          </View>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>CONTRACT SUMMARY</Text>
          <View style={S.tableRow}>
            <Text style={[S.td, { flex: 1 }]}>Original Contract Value</Text>
            <Text style={[S.td, { width: 100, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
              {fmt$(data.contractValue)}
            </Text>
          </View>
          {data.approvedCOs.map((co, i) => (
            <View key={i} style={S.tableRow}>
              <Text style={[S.tdGray, { flex: 1, paddingLeft: 12 }]}>CO: {co.description}</Text>
              <Text style={[S.tdGray, { width: 100, textAlign: "right" }]}>
                {fmt$(co.approvedValue)}
              </Text>
            </View>
          ))}
          <View style={S.subtotalRow}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
              Revised Contract Total
            </Text>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" }}>
              {fmt$(data.revisedContract)}
            </Text>
          </View>
        </View>

        {data.payments.length > 0 ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>PAYMENT HISTORY</Text>
            <View style={S.tableHeaderRow}>
              <Text style={[S.th, { width: 100 }]}>Date</Text>
              <Text style={[S.th, { flex: 1 }]}>Note</Text>
              <Text style={[S.th, { width: 80, textAlign: "right" }]}>Amount</Text>
            </View>
            {data.payments.map((p, i) => (
              <View key={i} style={S.tableRow}>
                <Text style={[S.tdGray, { width: 100 }]}>{fmtDate(p.date)}</Text>
                <Text style={[S.td, { flex: 1 }]}>{p.note ?? "—"}</Text>
                <Text style={[S.tdRight, { width: 80 }]}>{fmt$(p.amount)}</Text>
              </View>
            ))}
            <View style={S.subtotalRow}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Total Received</Text>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" }}>
                {fmt$(data.totalBilled)}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={S.balanceBox}>
          <View>
            <Text style={S.balanceLabel}>BALANCE REMAINING TO BILL</Text>
            <Text style={S.balanceAmount}>{fmt$(data.balanceRemaining)}</Text>
          </View>
          <View style={S.balanceRight}>
            <Text style={S.balanceRightText}>{fmt$(data.totalBilled)} received</Text>
            <Text style={S.balanceRightText}>of {fmt$(data.revisedContract)} contract</Text>
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>Oak Ridge Electrical LLC — Confidential</Text>
          <Text style={S.footerText}>Generated {today}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Change Order PDF ──────────────────────────────────────────────────────────

export type ChangeOrderDocData = {
  jobNumber: string;
  jobName: string;
  coNumber: number | null;
  date: Date | string | null;
  description: string;
  location: string | null;
  reason: string | null;
  requestedByName: string | null;
  requestedBy: { name: string | null };
  estimatedHours: number | null;
  estimatedLaborCost: number | null;
  estimatedMaterials: number | null;
  status: string;
  adminNotes: string | null;
  approvedValue: number | null;
  createdAt: Date | string;
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#b45309",
  APPROVED: "#15803d",
  REJECTED: "#dc2626",
};
const STATUS_BG: Record<string, string> = {
  PENDING: "#fef3c7",
  APPROVED: "#dcfce7",
  REJECTED: "#fee2e2",
};

export function ChangeOrderDoc({ data }: { data: ChangeOrderDocData }) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const estimatedTotal = (data.estimatedLaborCost ?? 0) + (data.estimatedMaterials ?? 0);

  const detailRows = ([
    ["Requested By", data.requestedByName ?? data.requestedBy.name],
    ["Date", fmtDate(data.date ?? data.createdAt)],
    ["Location", data.location],
    ["Reason", data.reason],
  ] as Array<[string, string | null | undefined]>).filter(([, v]) => v);

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        <View style={S.headerRow}>
          <View>
            <Text style={S.brandLabel}>OAK RIDGE ELECTRICAL LLC</Text>
            <Text style={S.jobName}>{data.jobName}</Text>
            <Text style={S.jobNum}>Job #{data.jobNumber}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerRightTitle}>
              Change Order {data.coNumber != null ? `#${data.coNumber}` : ""}
            </Text>
            <Text style={S.headerRightDate}>{today}</Text>
            <View
              style={{
                backgroundColor: STATUS_BG[data.status] ?? "#f3f4f6",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                marginTop: 4,
                alignSelf: "flex-end",
              }}
            >
              <Text
                style={{
                  fontSize: 7,
                  fontFamily: "Helvetica-Bold",
                  color: STATUS_COLOR[data.status] ?? "#374151",
                }}
              >
                {data.status}
              </Text>
            </View>
          </View>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>DESCRIPTION OF WORK</Text>
          <Text style={{ fontSize: 10, lineHeight: 1.5 }}>{data.description}</Text>
        </View>

        {detailRows.length > 0 ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>DETAILS</Text>
            <View style={S.infoGrid}>
              {detailRows.map(([label, value]) => (
                <View key={label} style={S.infoCell}>
                  <Text style={S.infoLabel}>{label}</Text>
                  <Text style={S.infoValue}>{value ?? ""}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={S.section}>
          <Text style={S.sectionTitle}>COST ESTIMATE</Text>
          {data.estimatedHours != null ? (
            <View style={S.tableRow}>
              <Text style={[S.td, { flex: 1 }]}>Estimated Hours</Text>
              <Text style={[S.td, { width: 100, textAlign: "right" }]}>
                {data.estimatedHours} hrs
              </Text>
            </View>
          ) : null}
          {data.estimatedLaborCost != null ? (
            <View style={S.tableRow}>
              <Text style={[S.td, { flex: 1 }]}>Estimated Labor Cost</Text>
              <Text style={[S.td, { width: 100, textAlign: "right" }]}>
                {fmt$(data.estimatedLaborCost)}
              </Text>
            </View>
          ) : null}
          {data.estimatedMaterials != null ? (
            <View style={S.tableRow}>
              <Text style={[S.td, { flex: 1 }]}>Estimated Materials</Text>
              <Text style={[S.td, { width: 100, textAlign: "right" }]}>
                {fmt$(data.estimatedMaterials)}
              </Text>
            </View>
          ) : null}
          {estimatedTotal > 0 ? (
            <View style={S.subtotalRow}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Estimated Total</Text>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" }}>
                {fmt$(estimatedTotal)}
              </Text>
            </View>
          ) : null}
        </View>

        {data.status === "APPROVED" || data.status === "REJECTED" || data.adminNotes ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>ADMIN REVIEW</Text>
            {data.adminNotes ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={S.infoLabel}>Notes</Text>
                <Text style={{ fontSize: 9, marginTop: 2 }}>{data.adminNotes}</Text>
              </View>
            ) : null}
            {data.status === "APPROVED" && data.approvedValue != null ? (
              <View
                style={[
                  S.balanceBox,
                  { backgroundColor: "#dcfce7", padding: 10 },
                ]}
              >
                <View>
                  <Text style={[S.balanceLabel, { color: "#166534" }]}>APPROVED VALUE</Text>
                  <Text style={[S.balanceAmount, { color: "#166534", fontSize: 14 }]}>
                    {fmt$(data.approvedValue)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>Oak Ridge Electrical LLC — Confidential</Text>
          <Text style={S.footerText}>Generated {today}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Inspection PDF ─────────────────────────────────────────────────────────────

const INSPECTION_LABELS: Record<string, string> = {
  UNDERGROUND: "Underground",
  ROUGH_IN: "Rough-In",
  SERVICE: "Service",
  FIRE_ALARM: "Fire Alarm",
  SPECIAL: "Special Inspection",
  FINAL: "Final",
};

export type InspectionDocData = {
  jobNumber: string;
  jobName: string;
  type: string;
  dateCalled: Date | string | null;
  dateScheduled: Date | string | null;
  inspectorName: string | null;
  inspectorPhone: string | null;
  result: "PASS" | "FAIL" | null;
  correctionNotes: string | null;
  reinspectDate: Date | string | null;
  notes: string | null;
  createdAt: Date | string;
  createdBy: { name: string | null };
};

export function InspectionDoc({ data }: { data: InspectionDocData }) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const typeLabel = INSPECTION_LABELS[data.type] ?? data.type;
  const isPassed = data.result === "PASS";
  const isFailed = data.result === "FAIL";
  const resultColor = isFailed ? "#dc2626" : isPassed ? "#16a34a" : "#555555";
  const resultText = isFailed ? "FAIL" : isPassed ? "PASS" : "PENDING";

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        <View style={S.headerRow}>
          <View>
            <Text style={S.brandLabel}>OAK RIDGE ELECTRICAL LLC</Text>
            <Text style={S.jobName}>{data.jobName}</Text>
            <Text style={S.jobNum}>Job #{data.jobNumber}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerRightTitle}>Inspection Record</Text>
            <Text style={S.headerRightDate}>{typeLabel}</Text>
          </View>
        </View>

        <View style={{
          backgroundColor: isFailed ? "#fef2f2" : isPassed ? "#f0fff4" : "#f5f5f5",
          borderWidth: 2,
          borderColor: resultColor,
          borderStyle: "solid",
          borderRadius: 6,
          padding: 12,
          marginBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <View>
            <Text style={{ fontSize: 7, color: GRAY, marginBottom: 3 }}>INSPECTION TYPE</Text>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY }}>{typeLabel}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 7, color: GRAY, marginBottom: 3 }}>RESULT</Text>
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: resultColor }}>{resultText}</Text>
          </View>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>INSPECTION DETAILS</Text>
          <View style={S.infoGrid}>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Date Called</Text>
              <Text style={S.infoValue}>{fmtDate(data.dateCalled)}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Date Scheduled</Text>
              <Text style={S.infoValue}>{fmtDate(data.dateScheduled)}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Inspector</Text>
              <Text style={S.infoValue}>{data.inspectorName ?? "—"}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Phone</Text>
              <Text style={S.infoValue}>{data.inspectorPhone ?? "—"}</Text>
            </View>
            {data.reinspectDate ? (
              <View style={S.infoCell}>
                <Text style={S.infoLabel}>Re-Inspect Date</Text>
                <Text style={[S.infoValue, { color: "#d97706" }]}>{fmtDate(data.reinspectDate)}</Text>
              </View>
            ) : null}
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Logged By</Text>
              <Text style={S.infoValue}>{data.createdBy.name ?? "Unknown"}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Date Logged</Text>
              <Text style={S.infoValue}>{fmtDate(data.createdAt)}</Text>
            </View>
          </View>
        </View>

        {data.correctionNotes ? (
          <View style={S.section}>
            <Text style={[S.sectionTitle, { color: "#dc2626" }]}>CORRECTIONS REQUIRED</Text>
            <View style={{
              backgroundColor: "#fef2f2",
              borderLeftWidth: 3,
              borderLeftColor: "#dc2626",
              borderLeftStyle: "solid",
              padding: 10,
              borderRadius: 3,
            }}>
              <Text style={{ fontSize: 9, color: "#1a1a1a", lineHeight: 1.5 }}>{data.correctionNotes}</Text>
            </View>
          </View>
        ) : null}

        {data.notes ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>NOTES</Text>
            <Text style={{ fontSize: 9, color: "#1a1a1a", lineHeight: 1.5 }}>{data.notes}</Text>
          </View>
        ) : null}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>Oak Ridge Electrical LLC — Confidential</Text>
          <Text style={S.footerText}>Generated {today}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── RFI PDF ───────────────────────────────────────────────────────────────────

export type RfiDocData = {
  jobNumber: string;
  jobName: string;
  rfiNumber: number;
  subject: string;
  description: string | null;
  submittedTo: string | null;
  submittedToEmail: string | null;
  status: "OPEN" | "ANSWERED";
  dueDate: Date | string | null;
  answeredDate: Date | string | null;
  answer: string | null;
  createdAt: Date | string;
  submittedBy: { name: string | null };
};

export function RfiDoc({ data }: { data: RfiDocData }) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const rfiLabel = `RFI-${String(data.rfiNumber).padStart(3, "0")}`;
  const isAnswered = data.status === "ANSWERED";

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        <View style={S.headerRow}>
          <View>
            <Text style={S.brandLabel}>OAK RIDGE ELECTRICAL LLC</Text>
            <Text style={S.jobName}>{data.jobName}</Text>
            <Text style={S.jobNum}>Job #{data.jobNumber}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerRightTitle}>Request for Information</Text>
            <Text style={S.headerRightDate}>{rfiLabel}</Text>
          </View>
        </View>

        <View style={{
          backgroundColor: isAnswered ? "#f0fff4" : "#fff8f5",
          borderWidth: 1,
          borderColor: isAnswered ? "#16a34a" : ORANGE,
          borderStyle: "solid",
          borderRadius: 6,
          padding: 10,
          marginBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <View>
            <Text style={{ fontSize: 7, color: GRAY, marginBottom: 2 }}>RFI NUMBER</Text>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY }}>{rfiLabel}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 7, color: GRAY, marginBottom: 2 }}>STATUS</Text>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: isAnswered ? "#16a34a" : ORANGE }}>
              {isAnswered ? "ANSWERED" : "OPEN"}
            </Text>
          </View>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>REQUEST DETAILS</Text>
          <View style={{ marginBottom: 10 }}>
            <Text style={[S.infoLabel, { marginBottom: 3 }]}>SUBJECT</Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>{data.subject}</Text>
          </View>
          <View style={S.infoGrid}>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Submitted To</Text>
              <Text style={S.infoValue}>{data.submittedTo ?? "—"}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Email</Text>
              <Text style={S.infoValue}>{data.submittedToEmail ?? "—"}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Submitted By</Text>
              <Text style={S.infoValue}>{data.submittedBy.name ?? "Unknown"}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Date Submitted</Text>
              <Text style={S.infoValue}>{fmtDate(data.createdAt)}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>Due Date</Text>
              <Text style={S.infoValue}>{fmtDate(data.dueDate)}</Text>
            </View>
            {isAnswered ? (
              <View style={S.infoCell}>
                <Text style={S.infoLabel}>Date Answered</Text>
                <Text style={S.infoValue}>{fmtDate(data.answeredDate)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {data.description ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>DESCRIPTION</Text>
            <Text style={{ fontSize: 9, color: "#1a1a1a", lineHeight: 1.5 }}>{data.description}</Text>
          </View>
        ) : null}

        {isAnswered && data.answer ? (
          <View style={S.section}>
            <Text style={[S.sectionTitle, { color: "#16a34a" }]}>RESPONSE</Text>
            <View style={{
              backgroundColor: "#f0fff4",
              borderLeftWidth: 3,
              borderLeftColor: "#16a34a",
              borderLeftStyle: "solid",
              padding: 10,
              borderRadius: 3,
            }}>
              <Text style={{ fontSize: 9, color: "#1a1a1a", lineHeight: 1.5 }}>{data.answer}</Text>
            </View>
          </View>
        ) : null}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>Oak Ridge Electrical LLC — Confidential</Text>
          <Text style={S.footerText}>Generated {today}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Standard Invoice ──────────────────────────────────────────────────────────

export type StandardInvoiceData = {
  jobNumber: string;
  jobName: string;
  gcCompany: string | null;
  gcContactName: string | null;
  gcEmail: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  contractStartDate: Date | string | null;
  invoiceNumber: number;
  invoiceDate: Date | string;
  periodTo: Date | string | null;
  amount: number;
  retainagePct: number | null;
  retainageHeld: number | null;
  lineItems: { label: string; amount: number }[];
  notes: string | null;
  previouslyInvoiced: number;
  // New Oak Ridge format fields
  invoiceKind?: string | null;
  scopeOfWork?: string | null;
  contractValue?: number | null;
  approvedCOs?: { coNumber: number | null; description: string; approvedValue: number }[];
  logoSrc?: string;  // base64 data URI or file path
  // Company settings (overrides hardcoded defaults)
  companyName?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyLogoUrl?: string | null;
};

const IS = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 45, color: "#1a1a1a", backgroundColor: "#fff" },
  // Centered header block
  headerCenter: { alignItems: "center", marginBottom: 10 },
  logo: { width: 64, height: 64, marginBottom: 6 },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "center", letterSpacing: 1 },
  companyInfo: { fontSize: 8, color: GRAY, textAlign: "center", marginTop: 2, lineHeight: 1.5 },
  // Dividers
  heavyDivider: { borderBottomWidth: 3, borderBottomColor: NAVY, borderBottomStyle: "solid", marginVertical: 10 },
  thinDivider: { borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: "solid", marginVertical: 8 },
  // Invoice title row
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 },
  invoiceTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", color: NAVY },
  invoiceKindLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: ORANGE, textAlign: "right", marginBottom: 2 },
  invoiceNumDate: { alignItems: "flex-end" },
  invoiceNum: { fontSize: 9, color: GRAY, textAlign: "right" },
  invoiceDate: { fontSize: 9, color: GRAY, textAlign: "right", marginTop: 1 },
  // Two-column project info
  twoCol: { flexDirection: "row", gap: 20, marginBottom: 16 },
  col: { flex: 1 },
  colLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.8, marginBottom: 5, textTransform: "uppercase" as const },
  colValue: { fontSize: 9, color: "#1a1a1a", lineHeight: 1.6 },
  colValueBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
  // Scope section
  scopeLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.8, marginBottom: 6, textTransform: "uppercase" as const },
  scopeRow: { flexDirection: "row", marginBottom: 4, gap: 6 },
  scopeNum: { fontSize: 9, color: GRAY, width: 18 },
  scopeText: { fontSize: 9, color: "#1a1a1a", flex: 1, lineHeight: 1.4 },
  // Financial summary (right-aligned)
  financialSection: { marginTop: 16, marginBottom: 16 },
  finRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 3 },
  finLabel: { fontSize: 9, color: GRAY, width: 260, textAlign: "right", paddingRight: 12 },
  finValue: { fontSize: 9, fontFamily: "Helvetica-Bold", width: 110, textAlign: "right" },
  finRowCO: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 3 },
  finLabelCO: { fontSize: 9, color: ORANGE, width: 260, textAlign: "right", paddingRight: 12 },
  finValueCO: { fontSize: 9, fontFamily: "Helvetica-Oblique", color: ORANGE, width: 110, textAlign: "right" },
  totalRow: {
    flexDirection: "row", justifyContent: "flex-end",
    paddingVertical: 6, marginTop: 4,
    borderTopWidth: 2, borderTopColor: NAVY, borderTopStyle: "solid",
  },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, width: 260, textAlign: "right", paddingRight: 12 },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, width: 110, textAlign: "right" },
  // Payment terms + warranty
  termsBox: { marginBottom: 10 },
  termsLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.8, marginBottom: 4, textTransform: "uppercase" as const },
  termsText: { fontSize: 8, color: GRAY, lineHeight: 1.5 },
  // Notes
  notesBox: { backgroundColor: "#f9fafb", borderRadius: 4, padding: 8, marginBottom: 10 },
  notesLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: LIGHT, marginBottom: 3 },
  notesText: { fontSize: 9, color: "#1a1a1a", lineHeight: 1.5 },
  // Footer
  invFooter: {
    position: "absolute", bottom: 28, left: 45, right: 45,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: "solid", paddingTop: 5,
  },
  invFooterText: { fontSize: 7, color: LIGHT },
});

export function StandardInvoiceDoc({ data }: { data: StandardInvoiceData }) {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const retainageHeld = data.retainageHeld ?? (data.retainagePct ? data.amount * data.retainagePct / 100 : 0);
  const approvedCOs = data.approvedCOs ?? [];
  const contractValue = data.contractValue ?? 0;
  const coTotal = approvedCOs.reduce((s, co) => s + co.approvedValue, 0);
  const invoiceKind = data.invoiceKind === "FINAL_INVOICE" ? "FINAL INVOICE" : "PROGRESS PAYMENT";

  // Company settings with fallbacks
  const co_name = data.companyName ?? "Oak Ridge Electrical LLC";
  const co_address = data.companyAddress ?? "209 W. River Rd";
  const co_city = data.companyCity ?? "Hooksett";
  const co_state = data.companyState ?? "NH";
  const co_zip = data.companyZip ?? "03106";
  const co_phone = data.companyPhone ?? "603-660-4651";
  const co_email = data.companyEmail ?? "Justin@oakridgeelectrical.com";
  const co_cityState = `${co_city}, ${co_state} ${co_zip}`;

  // Parse scope of work into numbered items
  const scopeItems: string[] = data.scopeOfWork
    ? data.scopeOfWork.split(/\n+/).map(s => s.trim()).filter(Boolean)
    : [];

  const projectAddress = [data.address, data.city, data.state].filter(Boolean).join(", ");

  return (
    <Document>
      <Page size="LETTER" style={IS.page}>

        {/* ── Centered Header ── */}
        <View style={IS.headerCenter}>
          {data.logoSrc ? (
            <Image src={data.logoSrc} style={IS.logo} />
          ) : null}
          <Text style={IS.companyName}>{co_name.toUpperCase()}</Text>
          <Text style={IS.companyInfo}>{co_address} · {co_cityState}{"\n"}{co_email}</Text>
        </View>

        <View style={IS.heavyDivider} />

        {/* ── INVOICE title + kind label ── */}
        <View style={IS.titleRow}>
          <Text style={IS.invoiceTitle}>INVOICE</Text>
          <View style={IS.invoiceNumDate}>
            <Text style={IS.invoiceKindLabel}>{invoiceKind}</Text>
            <Text style={IS.invoiceNum}>Invoice #{String(data.invoiceNumber).padStart(3, "0")}</Text>
            <Text style={IS.invoiceDate}>Date: {fmtDate(data.invoiceDate)}</Text>
            {data.periodTo ? <Text style={IS.invoiceDate}>Period To: {fmtDate(data.periodTo)}</Text> : null}
          </View>
        </View>

        <View style={IS.thinDivider} />

        {/* ── Project Info — two columns ── */}
        <View style={IS.twoCol}>
          <View style={IS.col}>
            <Text style={IS.colLabel}>From</Text>
            <Text style={IS.colValueBold}>{co_name}</Text>
            <Text style={IS.colValue}>{co_address}{"\n"}{co_cityState}</Text>
            <Text style={IS.colValue}>Justin Marceau, Owner</Text>
            <Text style={IS.colValue}>{co_phone}</Text>
            <Text style={IS.colValue}>{co_email}</Text>
          </View>
          <View style={IS.col}>
            <Text style={IS.colLabel}>To / Project</Text>
            {data.gcCompany ? <Text style={IS.colValueBold}>{data.gcCompany}</Text> : null}
            {data.gcContactName ? <Text style={IS.colValue}>{data.gcContactName}</Text> : null}
            {data.gcEmail ? <Text style={IS.colValue}>{data.gcEmail}</Text> : null}
            <Text style={[IS.colValueBold, { marginTop: 4 }]}>{data.jobName}</Text>
            <Text style={IS.colValue}>Job #{data.jobNumber}</Text>
            {projectAddress ? <Text style={IS.colValue}>{projectAddress}</Text> : null}
            {data.contractStartDate ? <Text style={IS.colValue}>Contract Date: {fmtDate(data.contractStartDate)}</Text> : null}
          </View>
        </View>

        <View style={IS.thinDivider} />

        {/* ── Scope of Work as numbered items ── */}
        {scopeItems.length > 0 ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={IS.scopeLabel}>Scope of Work</Text>
            {scopeItems.map((item, i) => (
              <View key={i} style={IS.scopeRow}>
                <Text style={IS.scopeNum}>{i + 1}.</Text>
                <Text style={IS.scopeText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Financial Summary (right-aligned) ── */}
        <View style={IS.financialSection}>
          {contractValue > 0 ? (
            <View style={IS.finRow}>
              <Text style={IS.finLabel}>Contract Total</Text>
              <Text style={IS.finValue}>{fmt$(contractValue)}</Text>
            </View>
          ) : null}

          {approvedCOs.map((co, i) => (
            <View key={i} style={IS.finRowCO}>
              <Text style={IS.finLabelCO}>
                Change Order {co.coNumber != null ? `#${co.coNumber}` : ""}{co.description ? ` — ${co.description}` : ""}
              </Text>
              <Text style={IS.finValueCO}>+{fmt$(co.approvedValue)}</Text>
            </View>
          ))}

          {coTotal > 0 && contractValue > 0 ? (
            <View style={[IS.finRow, { borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: "solid" }]}>
              <Text style={IS.finLabel}>Revised Contract Total</Text>
              <Text style={IS.finValue}>{fmt$(contractValue + coTotal)}</Text>
            </View>
          ) : null}

          <View style={IS.totalRow}>
            <Text style={IS.totalLabel}>INVOICE TOTAL</Text>
            <Text style={IS.totalValue}>{fmt$(data.amount)}</Text>
          </View>

          {retainageHeld > 0 ? (
            <View style={IS.finRow}>
              <Text style={IS.finLabel}>Less Retainage ({data.retainagePct ?? 0}%)</Text>
              <Text style={IS.finValue}>({fmt$(retainageHeld)})</Text>
            </View>
          ) : null}

          {retainageHeld > 0 ? (
            <View style={[IS.finRow, { borderTopWidth: 2, borderTopColor: NAVY, borderTopStyle: "solid" }]}>
              <Text style={[IS.finLabel, { color: NAVY, fontFamily: "Helvetica-Bold" }]}>CURRENT PAYMENT DUE</Text>
              <Text style={[IS.finValue, { color: NAVY }]}>{fmt$(data.amount - retainageHeld)}</Text>
            </View>
          ) : null}
        </View>

        <View style={IS.thinDivider} />

        {/* ── Payment Terms ── */}
        <View style={IS.termsBox}>
          <Text style={IS.termsLabel}>Payment Terms</Text>
          <Text style={IS.termsText}>
            Payment is due upon receipt of this invoice. Past due balances may incur a finance charge of 1.5% per month in accordance with New Hampshire law. Please remit payment to: {co_name}, {co_address}, {co_cityState}
          </Text>
        </View>

        {/* ── Warranty ── */}
        <View style={IS.termsBox}>
          <Text style={IS.termsLabel}>Warranty</Text>
          <Text style={IS.termsText}>
            Oak Ridge Electrical LLC provides a one-year workmanship warranty from the date of substantial completion. All installed equipment carries the applicable manufacturer&apos;s warranty. Warranty coverage does not extend to damage caused by misuse, modification by others, or conditions outside the scope of the original installation.
          </Text>
        </View>

        {/* ── Notes ── */}
        {data.notes ? (
          <View style={IS.notesBox}>
            <Text style={IS.notesLabel}>NOTES</Text>
            <Text style={IS.notesText}>{data.notes}</Text>
          </View>
        ) : null}

        {/* ── Footer ── */}
        <View style={IS.invFooter} fixed>
          <Text style={IS.invFooterText}>Thank you for your business! {co_name} — Justin Marceau, Owner — {co_phone} | {co_email}</Text>
          <Text style={IS.invFooterText}>Generated {today}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── AIA G702 / G703 ───────────────────────────────────────────────────────────

export type AiaData = {
  jobNumber: string;
  jobName: string;
  ownerName: string | null;
  gcCompany: string | null;
  gcContactName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  contractStartDate: Date | string | null;
  applicationNo: number;
  invoiceDate: Date | string;
  periodTo: Date | string | null;
  originalContractSum: number;
  netChangeByChangeOrders: number;
  contractSumToDate: number;
  totalCompletedAndStored: number;
  retainagePct: number;
  previousCertificates: number;
  currentPaymentDue: number;
  balanceToFinish: number;
  lineItems: {
    no: number;
    description: string;
    scheduledValue: number;
    previouslyBilled: number;
    thisPeriod: number;
    stored: number;
  }[];
  notes: string | null;
};

const AS = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8, padding: 36, color: "#1a1a1a" },
  title: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 2 },
  subtitle: { fontSize: 8, color: GRAY, marginBottom: 12 },
  aiaBox: { borderWidth: 1, borderColor: "#ccc", borderStyle: "solid", padding: 8, marginBottom: 8, borderRadius: 3, flex: 1 },
  aiaBoxTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: LIGHT, marginBottom: 4 },
  aiaRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  aiaLineRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: "solid", paddingVertical: 3 },
  aiaLineLabel: { fontSize: 8, color: GRAY, flex: 1 },
  aiaLineNum: { fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right", width: 90 },
  aiaLineNumBlue: { fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right", width: 90, color: NAVY },
  aiaSectionHeader: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 12, marginBottom: 6, borderBottomWidth: 2, borderBottomColor: NAVY, borderBottomStyle: "solid", paddingBottom: 3 },
  g703Head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: NAVY, borderBottomStyle: "solid", paddingBottom: 3, marginBottom: 2 },
  g703Row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, borderBottomStyle: "solid", paddingVertical: 4 },
  g703No:   { width: 20, fontSize: 7 },
  g703Desc: { flex: 1, fontSize: 7 },
  g703Sv:   { width: 60, fontSize: 7, textAlign: "right" },
  g703Prev: { width: 60, fontSize: 7, textAlign: "right" },
  g703This: { width: 60, fontSize: 7, textAlign: "right" },
  g703Stor: { width: 50, fontSize: 7, textAlign: "right" },
  g703Tot:  { width: 60, fontSize: 7, textAlign: "right" },
  g703Pct:  { width: 30, fontSize: 7, textAlign: "right" },
  g703Bal:  { width: 60, fontSize: 7, textAlign: "right" },
  aiaFooter: {
    position: "absolute", bottom: 28, left: 36, right: 36,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: "solid", paddingTop: 5,
  },
  aiaFooterText: { fontSize: 7, color: LIGHT },
});

export function AiaDoc({ data }: { data: AiaData }) {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const retainageHeld = data.totalCompletedAndStored * (data.retainagePct / 100);
  const totalEarnedLessRetainage = data.totalCompletedAndStored - retainageHeld;
  const lineItems = data.lineItems ?? [];

  return (
    <Document>
      {/* Page 1 — G702 */}
      <Page size="LETTER" style={AS.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <View>
            <Text style={AS.title}>AIA Document G702</Text>
            <Text style={AS.subtitle}>Application and Certificate for Payment</Text>
            <Text style={{ fontSize: 7, color: LIGHT }}>Oak Ridge Electrical LLC · 76 Oak Ridge Rd, Weare NH 03281</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY }}>Application No: {data.applicationNo}</Text>
            <Text style={{ fontSize: 8, color: GRAY }}>Date: {fmtDate(data.invoiceDate)}</Text>
            {data.periodTo ? <Text style={{ fontSize: 8, color: GRAY }}>Period To: {fmtDate(data.periodTo)}</Text> : null}
          </View>
        </View>

        <View style={AS.aiaRow}>
          <View style={AS.aiaBox}>
            <Text style={AS.aiaBoxTitle}>PROJECT</Text>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{data.jobName}</Text>
            <Text style={{ fontSize: 8, color: GRAY }}>Job #{data.jobNumber}</Text>
            {data.address ? <Text style={{ fontSize: 8, color: GRAY }}>{data.address}{data.city ? `, ${data.city}` : ""}{data.state ? `, ${data.state}` : ""}</Text> : null}
          </View>
          <View style={AS.aiaBox}>
            <Text style={AS.aiaBoxTitle}>TO OWNER / VIA</Text>
            {data.ownerName ? <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{data.ownerName}</Text> : null}
            {data.gcCompany ? <Text style={{ fontSize: 8, color: GRAY }}>Via: {data.gcCompany}</Text> : null}
            {data.gcContactName ? <Text style={{ fontSize: 8, color: GRAY }}>{data.gcContactName}</Text> : null}
          </View>
          <View style={AS.aiaBox}>
            <Text style={AS.aiaBoxTitle}>FROM CONTRACTOR</Text>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Oak Ridge Electrical LLC</Text>
            <Text style={{ fontSize: 8, color: GRAY }}>76 Oak Ridge Road, Weare NH 03281</Text>
            {data.contractStartDate ? <Text style={{ fontSize: 8, color: GRAY }}>Contract: {fmtDate(data.contractStartDate)}</Text> : null}
          </View>
        </View>

        <Text style={AS.aiaSectionHeader}>CONTRACTOR{"'"}S APPLICATION FOR PAYMENT</Text>

        <View style={AS.aiaLineRow}>
          <Text style={AS.aiaLineLabel}>1. Original Contract Sum</Text>
          <Text style={AS.aiaLineNum}>{fmt$(data.originalContractSum)}</Text>
        </View>
        <View style={AS.aiaLineRow}>
          <Text style={AS.aiaLineLabel}>2. Net Change by Change Orders</Text>
          <Text style={AS.aiaLineNum}>{fmt$(data.netChangeByChangeOrders)}</Text>
        </View>
        <View style={AS.aiaLineRow}>
          <Text style={AS.aiaLineLabel}>3. Contract Sum to Date (1 + 2)</Text>
          <Text style={AS.aiaLineNumBlue}>{fmt$(data.contractSumToDate)}</Text>
        </View>
        <View style={AS.aiaLineRow}>
          <Text style={AS.aiaLineLabel}>4. Total Completed {"&"} Stored to Date (Column G on G703)</Text>
          <Text style={AS.aiaLineNum}>{fmt$(data.totalCompletedAndStored)}</Text>
        </View>
        <View style={AS.aiaLineRow}>
          <Text style={AS.aiaLineLabel}>5. Retainage ({data.retainagePct}%)</Text>
          <Text style={AS.aiaLineNum}>{fmt$(retainageHeld)}</Text>
        </View>
        <View style={AS.aiaLineRow}>
          <Text style={AS.aiaLineLabel}>6. Total Earned Less Retainage (4 - 5)</Text>
          <Text style={AS.aiaLineNumBlue}>{fmt$(totalEarnedLessRetainage)}</Text>
        </View>
        <View style={AS.aiaLineRow}>
          <Text style={AS.aiaLineLabel}>7. Less Previous Certificates for Payment</Text>
          <Text style={AS.aiaLineNum}>({fmt$(data.previousCertificates)})</Text>
        </View>
        <View style={[AS.aiaLineRow, { borderBottomWidth: 2, borderBottomColor: NAVY }]}>
          <Text style={[AS.aiaLineLabel, { fontFamily: "Helvetica-Bold" }]}>8. CURRENT PAYMENT DUE (6 - 7)</Text>
          <Text style={[AS.aiaLineNumBlue, { fontSize: 11 }]}>{fmt$(data.currentPaymentDue)}</Text>
        </View>
        <View style={AS.aiaLineRow}>
          <Text style={AS.aiaLineLabel}>9. Balance to Finish, Including Retainage (3 - 6)</Text>
          <Text style={AS.aiaLineNum}>{fmt$(data.balanceToFinish)}</Text>
        </View>

        {data.notes ? (
          <View style={{ marginTop: 12, backgroundColor: "#f9fafb", borderRadius: 4, padding: 8 }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: LIGHT, marginBottom: 4 }}>NOTES</Text>
            <Text style={{ fontSize: 8, color: "#1a1a1a", lineHeight: 1.5 }}>{data.notes}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 16, flexDirection: "row", gap: 24 }}>
          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: "#aaa", borderTopStyle: "solid", paddingTop: 6 }}>
            <Text style={{ fontSize: 7, color: GRAY }}>Contractor Signature</Text>
            <View style={{ height: 28 }} />
            <Text style={{ fontSize: 8 }}>Oak Ridge Electrical LLC</Text>
            <Text style={{ fontSize: 7, color: LIGHT }}>Date: _______________</Text>
          </View>
          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: "#aaa", borderTopStyle: "solid", paddingTop: 6 }}>
            <Text style={{ fontSize: 7, color: GRAY }}>Architect / Owner Certification</Text>
            <View style={{ height: 28 }} />
            <Text style={{ fontSize: 7, color: LIGHT }}>Date: _______________</Text>
          </View>
        </View>

        <View style={AS.aiaFooter} fixed>
          <Text style={AS.aiaFooterText}>AIA G702 — Oak Ridge Electrical LLC — Job #{data.jobNumber}</Text>
          <Text style={AS.aiaFooterText}>Generated {today}</Text>
        </View>
      </Page>

      {/* Page 2 — G703 Continuation Sheet */}
      {lineItems.length > 0 ? (
        <Page size="LETTER" style={AS.page}>
          <Text style={AS.title}>AIA Document G703</Text>
          <Text style={AS.subtitle}>Continuation Sheet — Application No: {data.applicationNo} · {data.jobName} (#{data.jobNumber})</Text>

          <View style={AS.g703Head}>
            <Text style={AS.g703No}>A</Text>
            <Text style={AS.g703Desc}>B — Description of Work</Text>
            <Text style={AS.g703Sv}>C — Sched. Value</Text>
            <Text style={AS.g703Prev}>D — Prev. Billed</Text>
            <Text style={AS.g703This}>E — This Period</Text>
            <Text style={AS.g703Stor}>F — Stored</Text>
            <Text style={AS.g703Tot}>G — Total</Text>
            <Text style={AS.g703Pct}>%</Text>
            <Text style={AS.g703Bal}>H — Balance</Text>
          </View>

          {lineItems.map((li) => {
            const total = li.previouslyBilled + li.thisPeriod + li.stored;
            const pct = li.scheduledValue > 0 ? Math.round((total / li.scheduledValue) * 100) : 0;
            const balance = li.scheduledValue - total;
            return (
              <View key={li.no} style={AS.g703Row}>
                <Text style={AS.g703No}>{li.no}</Text>
                <Text style={AS.g703Desc}>{li.description}</Text>
                <Text style={AS.g703Sv}>{fmt$(li.scheduledValue)}</Text>
                <Text style={AS.g703Prev}>{fmt$(li.previouslyBilled)}</Text>
                <Text style={AS.g703This}>{fmt$(li.thisPeriod)}</Text>
                <Text style={AS.g703Stor}>{fmt$(li.stored)}</Text>
                <Text style={AS.g703Tot}>{fmt$(total)}</Text>
                <Text style={AS.g703Pct}>{pct}%</Text>
                <Text style={AS.g703Bal}>{fmt$(balance)}</Text>
              </View>
            );
          })}

          <View style={[AS.g703Row, { borderBottomWidth: 2, borderBottomColor: NAVY, backgroundColor: "#f0f4ff" }]}>
            <Text style={[AS.g703No, { fontFamily: "Helvetica-Bold" }]} />
            <Text style={[AS.g703Desc, { fontFamily: "Helvetica-Bold", fontSize: 8 }]}>GRAND TOTAL</Text>
            <Text style={[AS.g703Sv, { fontFamily: "Helvetica-Bold", fontSize: 8, color: NAVY }]}>
              {fmt$(lineItems.reduce((s, li) => s + li.scheduledValue, 0))}
            </Text>
            <Text style={[AS.g703Prev, { fontFamily: "Helvetica-Bold", fontSize: 8 }]}>
              {fmt$(lineItems.reduce((s, li) => s + li.previouslyBilled, 0))}
            </Text>
            <Text style={[AS.g703This, { fontFamily: "Helvetica-Bold", fontSize: 8, color: NAVY }]}>
              {fmt$(lineItems.reduce((s, li) => s + li.thisPeriod, 0))}
            </Text>
            <Text style={[AS.g703Stor, { fontFamily: "Helvetica-Bold", fontSize: 8 }]}>
              {fmt$(lineItems.reduce((s, li) => s + li.stored, 0))}
            </Text>
            <Text style={[AS.g703Tot, { fontFamily: "Helvetica-Bold", fontSize: 8, color: NAVY }]}>
              {fmt$(lineItems.reduce((s, li) => s + li.previouslyBilled + li.thisPeriod + li.stored, 0))}
            </Text>
            <Text style={[AS.g703Pct, { fontFamily: "Helvetica-Bold", fontSize: 8 }]}>
              {lineItems.reduce((s, li) => s + li.scheduledValue, 0) > 0
                ? Math.round((lineItems.reduce((s, li) => s + li.previouslyBilled + li.thisPeriod + li.stored, 0) / lineItems.reduce((s, li) => s + li.scheduledValue, 0)) * 100)
                : 0}%
            </Text>
            <Text style={[AS.g703Bal, { fontFamily: "Helvetica-Bold", fontSize: 8 }]}>
              {fmt$(lineItems.reduce((s, li) => s + li.scheduledValue - li.previouslyBilled - li.thisPeriod - li.stored, 0))}
            </Text>
          </View>

          <View style={AS.aiaFooter} fixed>
            <Text style={AS.aiaFooterText}>AIA G703 — Oak Ridge Electrical LLC — Job #{data.jobNumber}</Text>
            <Text style={AS.aiaFooterText}>Generated {today}</Text>
          </View>
        </Page>
      ) : null}
    </Document>
  );
}
