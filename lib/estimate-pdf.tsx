import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { BidTotals, EstimateData } from "./estimating";

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
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY },
  companyAddr: { fontSize: 8, color: GRAY, marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  bidLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: ORANGE },
  estNum: { fontSize: 8, color: GRAY, fontFamily: "Courier", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    paddingBottom: 3,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderBottomStyle: "solid",
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  rowLabel: { fontSize: 9, color: GRAY },
  rowValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  divider: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: "solid",
    marginVertical: 4,
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f0f4ff",
    padding: 10,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  grandValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  designFeeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  designFeeLabel: { fontSize: 8, color: LIGHT, fontStyle: "italic" },
  designFeeValue: { fontSize: 8, color: LIGHT, fontStyle: "italic" },
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
  infoRow: { flexDirection: "row", marginBottom: 3 },
  infoLabel: { width: 80, fontSize: 8, color: LIGHT },
  infoValue: { flex: 1, fontSize: 8 },
  notesBox: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
    padding: 8,
    borderRadius: 3,
    marginTop: 6,
  },
  notesText: { fontSize: 8, color: GRAY },
});

type EstimatePdfProps = {
  estimate: {
    estimateNumber: string;
    name: string;
    clientName?: string | null;
    address?: string | null;
    status: string;
    createdAt: Date;
    notes?: string | null;
    createdBy?: { name?: string | null } | null;
  };
  totals: BidTotals;
  data: EstimateData;
};

export function EstimatePdfDoc({ estimate, totals, data }: EstimatePdfProps) {
  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.companyName}>OAK RIDGE ELECTRICAL LLC</Text>
            <Text style={S.companyAddr}>209 W. River Rd, Hooksett, NH 03106</Text>
            <Text style={S.companyAddr}>Justin Marceau | 603-660-4651 | Justin@oakridgeelectrical.com</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.bidLabel}>BID SUMMARY</Text>
            <Text style={S.estNum}>{estimate.estimateNumber}</Text>
            <Text style={[S.companyAddr, { marginTop: 4 }]}>{fmtDate(estimate.createdAt)}</Text>
          </View>
        </View>

        {/* Project Info */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Project Information</Text>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Project Name</Text>
            <Text style={S.infoValue}>{estimate.name}</Text>
          </View>
          {estimate.clientName && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Client</Text>
              <Text style={S.infoValue}>{estimate.clientName}</Text>
            </View>
          )}
          {estimate.address && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Address</Text>
              <Text style={S.infoValue}>{estimate.address}</Text>
            </View>
          )}
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Status</Text>
            <Text style={S.infoValue}>{estimate.status}</Text>
          </View>
          {estimate.createdBy?.name && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Prepared By</Text>
              <Text style={S.infoValue}>{estimate.createdBy.name}</Text>
            </View>
          )}
        </View>

        {/* Materials */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Materials</Text>
          <View style={S.row}>
            <Text style={S.rowLabel}>Raw Material Total (with markup)</Text>
            <Text style={S.rowValue}>{fmt$(totals.markedUpMat)}</Text>
          </View>
        </View>

        {/* Labor */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Labor</Text>
          <View style={S.row}>
            <Text style={S.rowLabel}>Total Labor Hours</Text>
            <Text style={S.rowValue}>{totals.rawLhr.toFixed(2)} hrs</Text>
          </View>
          <View style={S.row}>
            <Text style={S.rowLabel}>Labor Rate</Text>
            <Text style={S.rowValue}>{fmt$(data.laborRate)}/hr</Text>
          </View>
          <View style={S.row}>
            <Text style={S.rowLabel}>Raw Labor Cost</Text>
            <Text style={S.rowValue}>{fmt$(totals.rawLabor)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.rowLabel}>Overhead ({(data.overhead * 100).toFixed(0)}%)</Text>
            <Text style={S.rowValue}>+{fmt$(totals.laborWithOverhead - totals.rawLabor)}</Text>
          </View>
          <View style={[S.row, { borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: "solid", paddingTop: 4, marginTop: 2 }]}>
            <Text style={[S.rowLabel, { fontFamily: "Helvetica-Bold" }]}>Labor with Overhead</Text>
            <Text style={S.rowValue}>{fmt$(totals.laborWithOverhead)}</Text>
          </View>
        </View>

        {/* Subtotal & Profit */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Summary</Text>
          <View style={S.row}>
            <Text style={S.rowLabel}>Subtotal (Mat + Labor w/ Overhead)</Text>
            <Text style={S.rowValue}>{fmt$(totals.subtotal)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.rowLabel}>Profit ({(data.profit * 100).toFixed(0)}%)</Text>
            <Text style={S.rowValue}>+{fmt$(totals.profit)}</Text>
          </View>
          <View style={S.row}>
            <Text style={[S.rowLabel, { fontFamily: "Helvetica-Bold" }]}>Base Bid Total</Text>
            <Text style={S.rowValue}>{fmt$(totals.grandTotal)}</Text>
          </View>
          {totals.permitTotal > 0 && (
            <View style={S.row}>
              <Text style={S.rowLabel}>Permits</Text>
              <Text style={S.rowValue}>+{fmt$(totals.permitTotal)}</Text>
            </View>
          )}
          {totals.subTotal > 0 && (
            <View style={S.row}>
              <Text style={S.rowLabel}>Subcontractors</Text>
              <Text style={S.rowValue}>+{fmt$(totals.subTotal)}</Text>
            </View>
          )}
        </View>

        {/* Grand Total */}
        <View style={S.grandRow}>
          <Text style={S.grandLabel}>GRAND TOTAL BID PRICE</Text>
          <Text style={S.grandValue}>{fmt$(totals.grandWithSubs)}</Text>
        </View>

        {/* Design Fee (internal) */}
        {totals.designFee > 0 && (
          <View style={S.designFeeRow}>
            <Text style={S.designFeeLabel}>Design Fee (internal — out of profit)</Text>
            <Text style={S.designFeeValue}>{fmt$(totals.designFee)}</Text>
          </View>
        )}

        {/* Notes */}
        {estimate.notes && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Notes</Text>
            <View style={S.notesBox}>
              <Text style={S.notesText}>{estimate.notes}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Oak Ridge Electrical LLC — 209 W. River Rd, Hooksett NH 03106</Text>
          <Text style={S.footerText}>{estimate.estimateNumber} — {estimate.name}</Text>
        </View>
      </Page>
    </Document>
  );
}
