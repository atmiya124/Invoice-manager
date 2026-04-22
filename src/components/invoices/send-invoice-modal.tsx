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
import { Send, X, Plus } from "lucide-react";

interface SendInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceWithClient;
  defaultSubject: string;
  defaultBody: string;
  senderName: string;
  senderEmail: string;
}

export function SendInvoiceModal({
  open,
  onClose,
  invoice,
  defaultSubject,
  defaultBody,
  senderName,
  senderEmail,
}: SendInvoiceModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");

  const billingPeriod =
    invoice.billingPeriodStart && invoice.billingPeriodEnd
      ? `${formatDate(invoice.billingPeriodStart)} – ${formatDate(invoice.billingPeriodEnd)}`
      : "";

  const templateVars: Record<string, string> = {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.companyName || invoice.client.name,
    total: formatCurrency(invoice.total, invoice.currency),
    amount: formatCurrency(invoice.total, invoice.currency),
    dueDate: formatDate(invoice.dueDate),
    period: billingPeriod,
    billingPeriod,
    paymentInstructions: invoice.paymentInstructions ?? "",
    senderName,
  };

  const [subject, setSubject] = useState(
    interpolateEmailTemplate(defaultSubject, templateVars)
  );
  const [body, setBody] = useState(
    interpolateEmailTemplate(defaultBody, templateVars)
  );

  function addCcEmail() {
    const email = ccInput.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid CC email address");
      return;
    }
    if (ccEmails.includes(email)) return;
    setCcEmails((prev) => [...prev, email]);
    setCcInput("");
    setError(null);
  }

  function removeCcEmail(email: string) {
    setCcEmails((prev) => prev.filter((e) => e !== email));
  }

  function handleCcKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCcEmail();
    }
  }

  async function handleSend() {
    setError(null);
    if (!subject.trim()) { setError("Subject is required"); return; }
    if (!body.trim()) { setError("Message is required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, ccEmails }),
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
              {ccEmails.length > 0 && ` + ${ccEmails.length} CC`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* From / To / Invoice / Amount */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">From</span>
                <span className="font-medium text-slate-700">
                  {senderName ? `${senderName} ` : ""}
                  <span className="text-slate-500 font-normal">&lt;{senderEmail}&gt;</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To</span>
                <span className="font-medium">{invoice.client.email}</span>
              </div>
              {ccEmails.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">CC</span>
                  <span className="text-slate-600 text-right max-w-[260px] truncate">{ccEmails.join(", ")}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-500">Invoice</span>
                <span className="font-medium">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-medium">{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>

            {/* CC field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                CC <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              {ccEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ccEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs text-indigo-700"
                    >
                      {email}
                      <button type="button" onClick={() => removeCcEmail(email)} className="text-indigo-400 hover:text-indigo-600">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={handleCcKeyDown}
                  type="email"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={addCcEmail}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">Press Enter or comma to add. Max 10 addresses.</p>
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
              📎 {invoice.invoiceNumber}.pdf will be automatically attached.
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

