"use client";

import { InvoiceWithClient } from "@/types";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/utils";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Send,
  Copy,
  MoreHorizontal,
  Download,
  Trash2,
  CheckCircle2,
  RotateCcw,
  FileEdit,
  SendHorizonal,
  AlertCircle,
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface InvoiceTableProps {
  invoices: InvoiceWithClient[];
  showClient?: boolean;
  selected?: Set<string>;
  onSelectChange?: (id: string) => void;
  onSelectAll?: () => void;
  onDeleted?: () => void;
  onStatusChanged?: () => void;
}

export function InvoiceTable({
  invoices,
  showClient = true,
  selected,
  onSelectChange,
  onSelectAll,
  onDeleted,
  onStatusChanged,
}: InvoiceTableProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [actionOpen, setActionOpen] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const allSelected = !!selected && selected.size === invoices.length && invoices.length > 0;

  function openMenu(id: string) {
    const btn = triggerRefs.current[id];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setActionOpen(id);
  }

  // Close on scroll
  useEffect(() => {
    if (!actionOpen) return;
    const close = () => setActionOpen(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [actionOpen]);

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

  async function deleteInvoice(invoiceId: string) {
    if (!await confirm("Delete this invoice? This cannot be undone.", { title: "Delete Invoice", confirmLabel: "Delete", danger: true })) return;
    setLoading(invoiceId);
    setActionOpen(null);
    try {
      await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      onDeleted?.();
    } finally {
      setLoading(null);
    }
  }

  async function changeStatus(invoiceId: string, status: string) {
    setLoading(invoiceId);
    setActionOpen(null);
    try {
      await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onStatusChanged?.();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {onSelectChange && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
            )}
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
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Status
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
              className={`hover:bg-slate-50/50 transition-colors ${selected?.has(invoice.id) ? "bg-indigo-50/40" : ""}`}
            >
              {onSelectChange && (
                <td className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected?.has(invoice.id) ?? false}
                    onChange={() => onSelectChange(invoice.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
              )}
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
              <td className="px-4 py-3">
                <StatusBadge status={invoice.status} />
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
                  <div>
                    <button
                      ref={(el) => { triggerRefs.current[invoice.id] = el; }}
                      onClick={() =>
                        actionOpen === invoice.id ? setActionOpen(null) : openMenu(invoice.id)
                      }
                      disabled={loading === invoice.id}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>

                    {actionOpen === invoice.id && menuPos && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setActionOpen(null)}
                        />
                        <div
                          className="fixed w-44 rounded-xl bg-white border border-slate-200 shadow-lg z-50 py-1 overflow-hidden"
                          style={{ top: menuPos.top, right: menuPos.right }}
                        >
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
                          <div className="my-1 border-t border-slate-100" />
                          <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Set status</p>
                          {([
                            { value: "DRAFT",   label: "Draft",   icon: <FileEdit className="h-3.5 w-3.5" />,     cls: "text-slate-600 hover:bg-slate-50" },
                            { value: "SENT",    label: "Sent",    icon: <SendHorizonal className="h-3.5 w-3.5" />, cls: "text-blue-700 hover:bg-blue-50" },
                            { value: "PAID",    label: "Paid",    icon: <CheckCircle2 className="h-3.5 w-3.5" />,  cls: "text-emerald-700 hover:bg-emerald-50" },
                            { value: "OVERDUE", label: "Overdue", icon: <AlertCircle className="h-3.5 w-3.5" />,   cls: "text-red-600 hover:bg-red-50" },
                          ] as const).filter((s) => s.value !== invoice.status).map((s) => (
                            <button
                              key={s.value}
                              onClick={() => changeStatus(invoice.id, s.value)}
                              disabled={loading === invoice.id}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-xs disabled:opacity-50 ${s.cls}`}
                            >
                              {s.icon}
                              {s.label}
                            </button>
                          ))}
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            onClick={() => deleteInvoice(invoice.id)}
                            disabled={loading === invoice.id}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </>
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

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-200",
  SENT: "bg-blue-50 text-blue-700 ring-blue-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  OVERDUE: "bg-red-50 text-red-700 ring-red-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
