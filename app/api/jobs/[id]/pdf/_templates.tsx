import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

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
