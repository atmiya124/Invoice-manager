"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SendInvoiceModal } from "@/components/invoices/send-invoice-modal";
import { InvoiceWithClient } from "@/types";
import { Send, Download, Edit, Copy, Trash2 } from "lucide-react";
import Link from "next/link";

interface InvoiceActionsProps {
  invoice: InvoiceWithClient;
  defaultEmailSubject: string;
  defaultEmailBody: string;
}

export function InvoiceActions({
  invoice,
  defaultEmailSubject,
  defaultEmailBody,
}: InvoiceActionsProps) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function duplicate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: "POST" });
      if (res.ok) {
        const newInvoice = await res.json();
        router.push(`/invoices/${newInvoice.id}/edit`);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteInvoice() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      router.push("/invoices");
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Download PDF */}
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          PDF
        </a>

        {/* Duplicate */}
        <Button variant="outline" size="md" onClick={duplicate} loading={loading}>
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>

        {/* Edit */}
        {invoice.status === "DRAFT" && (
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Link>
        )}

        {/* Send */}
        {(invoice.status === "DRAFT" || invoice.status === "SENT") && (
          <Button onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" />
            {invoice.status === "SENT" ? "Resend" : "Send"}
          </Button>
        )}

        {/* Delete */}
        {invoice.status === "DRAFT" && (
          <Button
            variant="danger"
            size="md"
            onClick={deleteInvoice}
            loading={deleteLoading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Send modal */}
      <SendInvoiceModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        invoice={invoice}
          defaultSubject={defaultEmailSubject}
          defaultBody={defaultEmailBody}
      />

    </>
  );
}
