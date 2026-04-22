"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { InvoiceWithClient } from "@/types";
import { formatCurrency, formatDate, interpolateEmailTemplate } from "@/lib/utils";
import { Send } from "lucide-react";

interface SendInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceWithClient;
  defaultSubject: string;
  defaultBody: string;
}

export function SendInvoiceModal({
  open,
  onClose,
  invoice,
  defaultSubject,
  defaultBody,
}: SendInvoiceModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Build template vars
  const templateVars: Record<string, string> = {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.companyName || invoice.client.name,
    total: formatCurrency(invoice.total, invoice.currency),
    dueDate: formatDate(invoice.dueDate),
    period:
      invoice.billingPeriodStart && invoice.billingPeriodEnd
        ? `${formatDate(invoice.billingPeriodStart)} – ${formatDate(invoice.billingPeriodEnd)}`
        : "",
    paymentInstructions: invoice.paymentInstructions ?? "",
    senderName: "",
  };

  const [subject, setSubject] = useState(
    interpolateEmailTemplate(defaultSubject, templateVars)
  );
  const [body, setBody] = useState(
    interpolateEmailTemplate(defaultBody, templateVars)
  );

  async function handleSend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send email");

      setSuccess(true);
      setTimeout(() => {
        onClose();
        router.refresh();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Send Invoice" size="lg">
      <DialogBody>
        {success ? (
          <div className="py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Send className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-slate-900">Invoice sent!</p>
            <p className="text-sm text-slate-500 mt-1">
              Email delivered to {invoice.client.email}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">To</span>
                <span className="font-medium">{invoice.client.email}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">Invoice</span>
                <span className="font-medium">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">Amount</span>
                <span className="font-medium">
                  {formatCurrency(invoice.total, invoice.currency)}
                </span>
              </div>
            </div>

            <FormField label="Subject" required htmlFor="email-subject">
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </FormField>

            <FormField label="Message" required htmlFor="email-body">
              <Textarea
                id="email-body"
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </FormField>

            <p className="text-xs text-slate-400">
              The invoice PDF will be automatically attached to this email.
            </p>
          </div>
        )}
      </DialogBody>

      {!success && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSend} loading={loading}>
            <Send className="h-4 w-4" />
            Send Invoice
          </Button>
        </DialogFooter>
      )}
    </Dialog>
  );
}
