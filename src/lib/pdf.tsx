import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { formatDate, formatCurrency } from "@/lib/utils";

// Register Helvetica (built-in PDF font – no external file needed)
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a2e",
    padding: 48,
    backgroundColor: "#ffffff",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  brandBlock: {
    maxWidth: 240,
  },
  brandName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#4f46e5",
    marginBottom: 4,
  },
  brandDetail: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  invoiceMeta: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 9,
    color: "#6b7280",
    width: 80,
    textAlign: "right",
    marginRight: 8,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    minWidth: 100,
    textAlign: "right",
  },
  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 24,
  },
  // Bill to section
  billSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  billBlock: {
    maxWidth: 240,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  billName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 2,
  },
  billDetail: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  periodBlock: {
    alignItems: "flex-end",
  },
  periodValue: {
    fontSize: 9,
    color: "#374151",
  },
  // Table
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  colDescription: { flex: 4 },
  colHours: { flex: 1, textAlign: "right" },
  colRate: { flex: 1.5, textAlign: "right" },
  colAmount: { flex: 1.5, textAlign: "right" },
  thText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tdText: {
    fontSize: 9,
    color: "#374151",
  },
  tdBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  // Totals
  totalsSection: {
    alignItems: "flex-end",
    marginBottom: 32,
  },
  totalRow: {
    flexDirection: "row",
    marginBottom: 4,
    width: 220,
  },
  totalLabel: {
    flex: 1,
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
    marginRight: 12,
  },
  totalValue: {
    fontSize: 9,
    color: "#374151",
    width: 80,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    backgroundColor: "#4f46e5",
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    width: 220,
  },
  grandTotalLabel: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "right",
    marginRight: 12,
  },
  grandTotalValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    width: 80,
    textAlign: "right",
  },
  // Payment info
  paymentSection: {
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: 16,
    marginBottom: 24,
  },
  paymentLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  paymentText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.6,
  },
  // Notes
  notesSection: {
    marginBottom: 24,
  },
  notesText: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.6,
  },
  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  // Status stamp
  statusPaid: {
    position: "absolute",
    top: 100,
    right: 48,
    borderWidth: 3,
    borderColor: "#22c55e",
    borderRadius: 4,
    padding: 6,
    transform: "rotate(-15deg)",
  },
  statusPaidText: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#22c55e",
    opacity: 0.4,
  },
});

export interface InvoicePDFProps {
  invoice: {
    invoiceNumber: string;
    status: string;
    billingType: string;
    billingPeriodStart: Date | null;
    billingPeriodEnd: Date | null;
    hoursWorked: number | null;
    hourlyRate: number | null;
    fixedAmount: number | null;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    currency: string;
    dueDate: Date | null;
    createdAt: Date;
    taskSummary: string | null;
    notes: string | null;
    paymentInstructions: string | null;
    client: {
      name: string;
      companyName: string | null;
      email: string;
      billingAddress: string | null;
    };
  };
  user: {
    name: string | null;
    businessName: string | null;
    businessEmail: string | null;
    businessAddress: string | null;
    businessPhone: string | null;
    hstNumber: string | null;
    paymentInstructions: string | null;
  };
}

export function InvoicePDF({ invoice, user }: InvoicePDFProps) {
  const displayName = user.name || user.businessName || "Freelancer";
  const displayBusiness = user.businessName && user.name ? user.businessName : null;
  const displayPayableName = user.businessName || user.name || "";

  const period =
    invoice.billingPeriodStart && invoice.billingPeriodEnd
      ? `${formatDate(invoice.billingPeriodStart)} – ${formatDate(invoice.billingPeriodEnd)}`
      : null;

  const payInstructions = invoice.paymentInstructions || user.paymentInstructions || null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* PAID watermark */}
        {invoice.status === "PAID" && (
          <View style={styles.statusPaid}>
            <Text style={styles.statusPaidText}>PAID</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>{displayName}</Text>
            {displayBusiness && (
              <Text style={styles.brandDetail}>{displayBusiness}</Text>
            )}
            {user.businessAddress && (
              <Text style={styles.brandDetail}>{user.businessAddress}</Text>
            )}
            {user.hstNumber && (
              <Text style={styles.brandDetail}>HST: {user.hstNumber}</Text>
            )}
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice #</Text>
              <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Submitted on</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.createdAt)}</Text>
            </View>
            {invoice.dueDate && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Due Date</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To / Payable To */}
        <View style={styles.billSection}>
          <View style={styles.billBlock}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.billName}>
              {invoice.client.companyName || invoice.client.name}
            </Text>
            {invoice.client.billingAddress && (
              <Text style={[styles.billDetail, { color: "#6366f1" }]}>
                {invoice.client.billingAddress}
              </Text>
            )}
            <Text style={styles.billDetail}>{invoice.client.email}</Text>
          </View>
          <View style={[styles.billBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.sectionLabel}>Payable To</Text>
            <Text style={styles.billName}>{displayPayableName}</Text>
            {user.businessEmail && (
              <Text style={styles.billDetail}>{user.businessEmail}</Text>
            )}
            {period && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.sectionLabel}>Billing Period</Text>
                <Text style={styles.periodValue}>{period}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colDescription}>
              <Text style={styles.thText}>Description</Text>
            </View>
            {invoice.billingType === "HOURLY" && (
              <>
                <View style={styles.colHours}>
                  <Text style={styles.thText}>Hours</Text>
                </View>
                <View style={styles.colRate}>
                  <Text style={styles.thText}>Rate</Text>
                </View>
              </>
            )}
            <View style={styles.colAmount}>
              <Text style={styles.thText}>Amount</Text>
            </View>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.colDescription}>
              <Text style={styles.tdBold}>
                {invoice.taskSummary || "Professional Services"}
              </Text>
              {invoice.notes && (
                <Text style={[styles.tdText, { marginTop: 2, color: "#6b7280" }]}>
                  {invoice.notes}
                </Text>
              )}
            </View>
            {invoice.billingType === "HOURLY" && (
              <>
                <View style={styles.colHours}>
                  <Text style={styles.tdText}>
                    {invoice.hoursWorked?.toString() ?? "—"}
                  </Text>
                </View>
                <View style={styles.colRate}>
                  <Text style={styles.tdText}>
                    {invoice.hourlyRate != null
                      ? formatCurrency(invoice.hourlyRate, invoice.currency)
                      : "—"}
                  </Text>
                </View>
              </>
            )}
            <View style={styles.colAmount}>
              <Text style={styles.tdBold}>
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(invoice.subtotal, invoice.currency)}
            </Text>
          </View>
          {invoice.taxRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({invoice.taxRate}%)</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(invoice.taxAmount, invoice.currency)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(invoice.total, invoice.currency)}
            </Text>
          </View>
        </View>

        {/* Payment Instructions */}
        {payInstructions && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>Payment Instructions</Text>
            <Text style={styles.paymentText}>{payInstructions}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{invoice.invoiceNumber}</Text>
          <Text style={styles.footerText}>
            Thank you for your business!
          </Text>
          <Text style={styles.footerText}>
            {displayName}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
