import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatDateRange,
} from "@/lib/utils";
import { InvoiceActions } from "./invoice-actions";
import { EmailHistoryTable } from "@/components/invoices/email-history-table";

type Params = { params: Promise<{ id: string }> };

export default async function InvoiceDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const { invoices: invoicesTable, clients: clientsTable, users, emailLogs: emailLogsTable } = await import("@/lib/schema");
  const { and, eq, desc } = await import("drizzle-orm");

  const [invoice, user] = await Promise.all([
    db.query.invoices.findFirst({
      where: and(eq(invoicesTable.id, id), eq(invoicesTable.userId, session.user.id)),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            companyName: true,
            email: true,
            billingAddress: true,
            currency: true,
          },
        },
        emailLogs: { orderBy: desc(emailLogsTable.sentAt) },
      },
    }),
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        name: true,
        email: true,
        businessName: true,
        businessEmail: true,
        businessAddress: true,
        businessPhone: true,
        hstNumber: true,
        defaultEmailSubject: true,
        defaultEmailBody: true,
      },
    }),
  ]);

  if (!invoice) notFound();

  const inv = invoice;

  const clientEmailTemplate = await db.query.clients.findFirst({
    where: eq(clientsTable.id, inv.clientId),
    columns: { emailTemplate: true },
  });

  const emailSubject =
    inv.emailSubject ||
    user?.defaultEmailSubject ||
    "Invoice {{invoiceNumber}} - {{period}}";

  const emailBody =
    clientEmailTemplate?.emailTemplate ||
    inv.emailBody ||
    user?.defaultEmailBody ||
    "Hi {{clientName}},\n\nPlease find attached invoice {{invoiceNumber}} for the period {{period}}.\n\nAmount due: {{total}}\nDue date: {{dueDate}}\n\n{{paymentInstructions}}\n\nThank you for your business!\n{{senderName}}";

  const displayName = user?.name ?? "Freelancer";
  const displayBusiness = user?.businessName;
  const displayAddress = user?.businessAddress;
  const displayHst = user?.hstNumber;
  const displayPayableName = user?.businessName ?? user?.name ?? "";
  const displayPayableEmail = user?.businessEmail;

  return (
    <div className="space-y-4">
      {/* ── Top action bar ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{inv.invoiceNumber}</h2>
            <p className="text-slate-400 text-sm">
              {inv.client.companyName || inv.client.name} · {formatDate(inv.createdAt)}
            </p>
          </div>
        </div>
        <InvoiceActions
          invoice={inv}
          defaultEmailSubject={emailSubject}
          defaultEmailBody={emailBody}
          senderName={user?.name ?? ""}
          senderEmail={user?.email ?? ""}
        />
      </div>

      {/* ── Invoice document card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">

        {/* Section 1: Business info + INVOICE label */}
        <div className="flex items-start justify-between mb-10">
          {/* Left: your info */}
          <div>
            <p className="text-2xl font-bold text-indigo-600 leading-tight">{displayName}</p>
            {displayBusiness && (
              <p className="text-sm text-slate-500 mt-0.5">{displayBusiness}</p>
            )}
            {displayAddress && (
              <p className="text-sm text-slate-400 mt-1 whitespace-pre-line">{displayAddress}</p>
            )}
            {displayHst && (
              <p className="text-sm text-slate-400 mt-0.5">HST: {displayHst}</p>
            )}
          </div>
          {/* Right: INVOICE + meta */}
          <div className="text-right">
            <p className="text-3xl font-black text-slate-800 tracking-tight mb-3">INVOICE</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-end gap-8">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Invoice #</span>
                <span className="font-semibold text-slate-800 min-w-[120px] text-right">{inv.invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-end gap-8">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Submitted on</span>
                <span className="text-slate-600 min-w-[120px] text-right">{formatDate(inv.createdAt)}</span>
              </div>
              {inv.dueDate && (
                <div className="flex items-center justify-end gap-8">
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Due</span>
                  <span className="font-semibold text-red-500 min-w-[120px] text-right">{formatDate(inv.dueDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Bill To / Payable To / Billing Period */}
        <div className="flex items-start justify-between mb-10">
          {/* Bill To */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bill To</p>
            <p className="font-bold text-slate-800 text-sm">
              {inv.client.companyName || inv.client.name}
            </p>
            {inv.client.billingAddress && (
              <p className="text-sm text-slate-400 mt-0.5 whitespace-pre-line">{inv.client.billingAddress}</p>
            )}
          </div>
          {/* Payable To + Billing Period */}
          <div className="text-right space-y-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Payable To</p>
              <p className="font-bold text-slate-800 text-sm">{displayPayableName}</p>
              {displayPayableEmail && (
                <p className="text-sm text-slate-400 mt-0.5">{displayPayableEmail}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Line items table */}
        <div className="mb-8">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 pb-3 border-b border-slate-200">
            <div className="col-span-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</div>
            {inv.billingType === "HOURLY" && (
              <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Hours</div>
            )}
            <div className={`${inv.billingType === "HOURLY" ? "col-span-2" : "col-span-4"} text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right`}>
              Rate
            </div>
            <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</div>
          </div>

          {/* Table row */}
          <div className="grid grid-cols-12 gap-4 py-5 border-b border-slate-100 items-center">
            <div className="col-span-6">
              <p className="font-medium text-slate-800 text-sm">
                {inv.taskSummary || "Professional Services"}
              </p>
              {inv.notes && (
                <p className="text-xs text-slate-400 mt-1">{inv.notes}</p>
              )}
            </div>
            {inv.billingType === "HOURLY" && (
              <div className="col-span-2 text-sm text-slate-700 text-right font-medium">
                {inv.hoursWorked ?? "—"}
              </div>
            )}
            <div className={`${inv.billingType === "HOURLY" ? "col-span-2" : "col-span-4"} text-sm text-slate-700 text-right`}>
              {inv.billingType === "HOURLY"
                ? (inv.hourlyRate != null ? formatCurrency(inv.hourlyRate, inv.currency) : "—")
                : (inv.fixedAmount != null ? formatCurrency(inv.fixedAmount, inv.currency) : "—")}
            </div>
            <div className="col-span-2 text-sm font-bold text-slate-900 text-right">
              {formatCurrency(inv.subtotal, inv.currency)}
            </div>
          </div>
        </div>

        {/* Section 4: Totals */}
        <div className="flex justify-end mb-10">
          <div className="w-72 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-700">{formatCurrency(inv.subtotal, inv.currency)}</span>
            </div>
            {inv.taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tax ({inv.taxRate}%)</span>
                <span className="font-medium text-slate-700">{formatCurrency(inv.taxAmount, inv.currency)}</span>
              </div>
            )}
            <div className="flex justify-between items-center font-bold text-white bg-indigo-600 rounded-xl px-5 py-3 text-sm mt-1">
              <span>Total Due</span>
              <span className="text-base">{formatCurrency(inv.total, inv.currency)}</span>
            </div>
          </div>
        </div>

        {/* Section 5: Payment instructions */}
        {inv.paymentInstructions && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Payment Instructions
            </p>
            <p className="text-sm text-slate-600 whitespace-pre-line">{inv.paymentInstructions}</p>
          </div>
        )}
      </div>

      {/* ── Private notes ── */}
      {inv.privateNotes && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Private Notes</p>
          <p className="text-sm text-slate-600 whitespace-pre-line">{inv.privateNotes}</p>
        </div>
      )}

      {/* ── Email history ── */}
      <EmailHistoryTable invoiceId={inv.id} logs={inv.emailLogs} />
    </div>
  );
}

