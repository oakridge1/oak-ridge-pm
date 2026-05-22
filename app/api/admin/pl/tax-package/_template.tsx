import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#002D72";
const ORANGE = "#FF5910";
const GRAY_BG = "#F3F4F6";
const GRAY_BORDER = "#E5E7EB";

export function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function getQuarterDates(
  quarter: number,
  year: number
): { start: Date; end: Date } {
  const qm = (quarter - 1) * 3;
  return {
    start: new Date(year, qm, 1),
    end: new Date(year, qm + 3, 0, 23, 59, 59, 999),
  };
}

export function getOverheadForPeriod(
  costs: Array<{
    category: string;
    amount: number;
    isRecurring: boolean;
    effectiveDate: Date;
    endDate: Date | null;
  }>,
  start: Date,
  end: Date
): { byCategory: Array<{ category: string; amount: number }>; total: number } {
  const categoryMap = new Map<string, number>();
  let total = 0;
  for (const c of costs) {
    if (!c.isRecurring) {
      if (c.effectiveDate >= start && c.effectiveDate <= end) {
        categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + c.amount);
        total += c.amount;
      }
      continue;
    }
    if (c.effectiveDate > end) continue;
    if (c.endDate !== null && c.endDate < start) continue;
    categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + c.amount);
    total += c.amount;
  }
  return {
    byCategory: Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    total,
  };
}

export interface TaxPackageData {
  quarter: number;
  year: number;
  label: string;
  generated: string;
  notes: string;
  revenue: {
    totalInvoiced: number;
    totalCollected: number;
    outstanding: number;
  };
  directCosts: {
    labor: number;
    materials: number;
    subcontractors: number;
    equipment: number;
    other: number;
    total: number;
  };
  grossProfit: number;
  grossMarginPct: number;
  overhead: {
    byCategory: Array<{ category: string; amount: number }>;
    total: number;
  };
  distributions: {
    draws: Array<{ name: string; amount: number }>;
    contractors: Array<{ name: string; amount: number }>;
    drawsTotal: number;
    contractorsTotal: number;
    total: number;
  };
  netProfit: number;
  netMarginPct: number;
  jobs: Array<{
    jobNumber: string;
    jobName: string;
    status: string;
    invoiced: number;
    directCosts: number;
    grossProfit: number;
    marginPct: number;
  }>;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
    padding: 48,
    backgroundColor: "#FFFFFF",
  },
  coverPage: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
    padding: 48,
    backgroundColor: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center",
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: ORANGE,
    textAlign: "center",
    marginBottom: 32,
  },
  coverMeta: {
    fontSize: 10,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 8,
  },
  coverNotes: {
    marginTop: 32,
    padding: 16,
    backgroundColor: GRAY_BG,
    borderRadius: 4,
    width: "80%",
  },
  coverNotesLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  coverNotesText: { fontSize: 10, color: "#374151" },
  sectionHeader: {
    backgroundColor: NAVY,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    padding: "6 10",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_BORDER,
  },
  rowAlt: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: GRAY_BG,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_BORDER,
  },
  rowLabel: { color: "#374151", flex: 1 },
  rowValue: {
    color: "#111827",
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    minWidth: 80,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopWidth: 1.5,
    borderTopColor: NAVY,
    marginTop: 2,
  },
  totalLabel: { fontFamily: "Helvetica-Bold", color: NAVY, flex: 1 },
  totalValue: {
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
    minWidth: 80,
  },
  netPositive: {
    fontFamily: "Helvetica-Bold",
    color: "#059669",
    textAlign: "right",
    minWidth: 80,
  },
  netNegative: {
    fontFamily: "Helvetica-Bold",
    color: "#DC2626",
    textAlign: "right",
    minWidth: 80,
  },
  spacer: { marginTop: 20 },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9CA3AF",
    borderTopWidth: 0.5,
    borderTopColor: GRAY_BORDER,
    paddingTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_BORDER,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: GRAY_BG,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_BORDER,
  },
  tableCell: { fontSize: 8, color: "#374151" },
  tableCellRight: { fontSize: 8, color: "#374151", textAlign: "right" },
});

function PageFooter({ label, generated }: { label: string; generated: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>Oak Ridge Electrical LLC — {label}</Text>
      <Text>Generated {generated}</Text>
    </View>
  );
}

export function TaxPackagePDF({ data }: { data: TaxPackageData }) {
  return (
    <Document title={`Oak Ridge Electrical LLC — ${data.label} Financial Summary`}>

      {/* Cover */}
      <Page size="LETTER" style={styles.coverPage}>
        <Text style={styles.coverTitle}>Oak Ridge Electrical LLC</Text>
        <Text style={styles.coverSubtitle}>{data.label} Financial Summary</Text>
        <Text style={styles.coverMeta}>Generated: {data.generated}</Text>
        <Text style={styles.coverMeta}>Confidential — For Tax Preparation Use Only</Text>
        {data.notes ? (
          <View style={styles.coverNotes}>
            <Text style={styles.coverNotesLabel}>Notes</Text>
            <Text style={styles.coverNotesText}>{data.notes}</Text>
          </View>
        ) : null}
        <PageFooter label={data.label} generated={data.generated} />
      </Page>

      {/* Revenue */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionHeader}>Revenue Summary</Text>
        {[
          { label: "Total Invoiced", value: fmt(data.revenue.totalInvoiced) },
          { label: "Total Collected (Cash Received)", value: fmt(data.revenue.totalCollected) },
          { label: "Outstanding / Receivable", value: fmt(data.revenue.outstanding) },
        ].map((row, i) => (
          <View key={i} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Net Revenue (Collected)</Text>
          <Text style={styles.totalValue}>{fmt(data.revenue.totalCollected)}</Text>
        </View>
        <PageFooter label={data.label} generated={data.generated} />
      </Page>

      {/* Direct Costs + Gross Profit */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionHeader}>Direct Costs &amp; Gross Profit</Text>
        {[
          { label: "Labor (Burdened Wages)", value: fmt(data.directCosts.labor) },
          { label: "Materials", value: fmt(data.directCosts.materials) },
          { label: "Subcontractors", value: fmt(data.directCosts.subcontractors) },
          { label: "Equipment", value: fmt(data.directCosts.equipment) },
          { label: "Other Direct Costs", value: fmt(data.directCosts.other) },
        ].map((row, i) => (
          <View key={i} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Direct Costs</Text>
          <Text style={styles.totalValue}>{fmt(data.directCosts.total)}</Text>
        </View>
        <View style={[styles.spacer, { marginTop: 24 }]}>
          <Text style={styles.sectionHeader}>Gross Profit</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Revenue (Invoiced)</Text>
            <Text style={styles.rowValue}>{fmt(data.revenue.totalInvoiced)}</Text>
          </View>
          <View style={styles.rowAlt}>
            <Text style={styles.rowLabel}>Less: Direct Costs</Text>
            <Text style={styles.rowValue}>({fmt(data.directCosts.total)})</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Gross Profit</Text>
            <Text style={data.grossProfit >= 0 ? styles.netPositive : styles.netNegative}>
              {fmt(data.grossProfit)} ({data.grossMarginPct.toFixed(1)}%)
            </Text>
          </View>
        </View>
        <PageFooter label={data.label} generated={data.generated} />
      </Page>

      {/* Overhead */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionHeader}>Overhead Expenses by Category</Text>
        {data.overhead.byCategory.length === 0 ? (
          <Text style={{ color: "#9CA3AF", fontSize: 10 }}>No overhead costs recorded for this period.</Text>
        ) : (
          data.overhead.byCategory.map((row, i) => (
            <View key={i} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
              <Text style={styles.rowLabel}>{row.category}</Text>
              <Text style={styles.rowValue}>{fmt(row.amount)}</Text>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Overhead</Text>
          <Text style={styles.totalValue}>{fmt(data.overhead.total)}</Text>
        </View>
        <PageFooter label={data.label} generated={data.generated} />
      </Page>

      {/* Distributions */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionHeader}>Owner Draws</Text>
        {data.distributions.draws.length === 0 ? (
          <Text style={{ color: "#9CA3AF", fontSize: 10 }}>No owner draws recorded for this period.</Text>
        ) : (
          data.distributions.draws.map((row, i) => (
            <View key={i} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
              <Text style={styles.rowLabel}>{row.name}</Text>
              <Text style={styles.rowValue}>{fmt(row.amount)}</Text>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Owner Draws</Text>
          <Text style={styles.totalValue}>{fmt(data.distributions.drawsTotal)}</Text>
        </View>
        <View style={styles.spacer}>
          <Text style={styles.sectionHeader}>Contractor Payments</Text>
          {data.distributions.contractors.length === 0 ? (
            <Text style={{ color: "#9CA3AF", fontSize: 10 }}>No contractor payments recorded for this period.</Text>
          ) : (
            data.distributions.contractors.map((row, i) => (
              <View key={i} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
                <Text style={styles.rowLabel}>{row.name}</Text>
                <Text style={styles.rowValue}>{fmt(row.amount)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Contractor Payments</Text>
            <Text style={styles.totalValue}>{fmt(data.distributions.contractorsTotal)}</Text>
          </View>
        </View>
        <PageFooter label={data.label} generated={data.generated} />
      </Page>

      {/* Job Table */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionHeader}>Job-by-Job Profitability</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: 50 }]}>Job #</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Job Name</Text>
          <Text style={[styles.tableHeaderCell, { width: 55, textAlign: "right" }]}>Invoiced</Text>
          <Text style={[styles.tableHeaderCell, { width: 55, textAlign: "right" }]}>Dir. Costs</Text>
          <Text style={[styles.tableHeaderCell, { width: 55, textAlign: "right" }]}>Gross Profit</Text>
          <Text style={[styles.tableHeaderCell, { width: 35, textAlign: "right" }]}>Margin</Text>
        </View>
        {data.jobs.map((job, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={[styles.tableCell, { width: 50 }]}>{job.jobNumber}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{job.jobName}</Text>
            <Text style={[styles.tableCellRight, { width: 55 }]}>{fmt(job.invoiced)}</Text>
            <Text style={[styles.tableCellRight, { width: 55 }]}>{fmt(job.directCosts)}</Text>
            <Text style={[styles.tableCellRight, { width: 55, color: job.grossProfit >= 0 ? "#059669" : "#DC2626" }]}>
              {fmt(job.grossProfit)}
            </Text>
            <Text style={[styles.tableCellRight, { width: 35 }]}>{job.marginPct.toFixed(1)}%</Text>
          </View>
        ))}
        <PageFooter label={data.label} generated={data.generated} />
      </Page>

      {/* Net Profit */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionHeader}>Net Profit / Loss Statement</Text>
        {[
          { label: "Gross Profit", value: fmt(data.grossProfit) },
          { label: "Less: Overhead Expenses", value: `(${fmt(data.overhead.total)})` },
          { label: "Less: Owner Draws", value: `(${fmt(data.distributions.drawsTotal)})` },
          { label: "Less: Contractor Payments", value: `(${fmt(data.distributions.contractorsTotal)})` },
        ].map((row, i) => (
          <View key={i} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Net Profit / Loss</Text>
          <Text style={data.netProfit >= 0 ? styles.netPositive : styles.netNegative}>
            {fmt(data.netProfit)} ({data.netMarginPct.toFixed(1)}%)
          </Text>
        </View>
        <View style={{ marginTop: 40, padding: 16, backgroundColor: GRAY_BG, borderRadius: 4 }}>
          <Text style={{ fontSize: 9, color: "#6B7280", fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
            DISCLAIMER
          </Text>
          <Text style={{ fontSize: 8, color: "#9CA3AF", lineHeight: 1.4 }}>
            This report is generated from Oak Ridge Electrical LLC project management data. It is intended
            for internal review and tax preparation purposes only. Please verify all figures with your
            accountant before filing. This report does not constitute a formal financial statement.
          </Text>
        </View>
        <PageFooter label={data.label} generated={data.generated} />
      </Page>

    </Document>
  );
}
