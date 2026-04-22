"use client";

import { InvoiceWithClient } from "@/types";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Send,
  Copy,
  MoreHorizontal,
  Download,
} from "lucide-react";

interface InvoiceTableProps {
  invoices: InvoiceWithClient[];
  showClient?: boolean;
}

export function InvoiceTable({
  invoices,
  showClient = true,
}: InvoiceTableProps) {
  const router = useRouter();
  const [actionOpen, setActionOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-12 w-12 text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">No invoices found</p>
        <p className="text-sm text-slate-400 mt-1">
          Create your first invoice to get started
        </p>
      </div>
    );
  }

  async function duplicateInvoice(invoiceId: string) {
    setLoading(invoiceId);
    setActionOpen(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "POST", // POST on an existing invoice = duplicate
      });
      if (res.ok) {
        const newInvoice = await res.json();
        router.push(`/invoices/${newInvoice.id}/edit`);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  function downloadPdf(invoiceId: string) {
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank");
    setActionOpen(null);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Invoice
            </th>
            {showClient && (
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Client
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Period
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Due
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className="hover:bg-slate-50/50 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {invoice.invoiceNumber}
                </Link>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDate(invoice.createdAt)}
                </p>
              </td>
              {showClient && (
                <td className="px-4 py-3">
                  <Link
                    href={`/clients/${invoice.clientId}`}
                    className="text-slate-700 hover:text-slate-900 font-medium transition-colors"
                  >
                    {invoice.client.companyName || invoice.client.name}
                  </Link>
                  {invoice.client.companyName && (
                    <p className="text-xs text-slate-400">
                      {invoice.client.name}
                    </p>
                  )}
                </td>
              )}
              <td className="px-4 py-3 text-slate-500 text-xs">
                {formatDateRange(
                  invoice.billingPeriodStart,
                  invoice.billingPeriodEnd
                )}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(invoice.total, invoice.currency)}
              </td>
              <td className="px-4 py-3 text-slate-500 text-xs">
                {formatDate(invoice.dueDate)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    title="View invoice"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Link>

                  {/* Actions dropdown */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActionOpen(
                          actionOpen === invoice.id ? null : invoice.id
                        )
                      }
                      className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>

                    {actionOpen === invoice.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-white border border-slate-200 shadow-lg z-10 py-1 overflow-hidden">
                        <button
                          onClick={() => downloadPdf(invoice.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                        <button
                          onClick={() => duplicateInvoice(invoice.id)}
                          disabled={loading === invoice.id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
