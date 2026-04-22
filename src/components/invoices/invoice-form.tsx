"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogBody } from "@/components/ui/dialog";
import { Eye, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import type { Client } from "@/types";
import {
  calculateInvoiceTotals,
  formatCurrency,
  getBillingPeriodDates,
  toDecimal,
} from "@/lib/utils";

interface InvoiceFormProps {
  clients: Client[];
  invoiceId?: string;
  defaultClientId?: string;
  defaultValues?: Partial<InvoiceFormData>;
  userDefaults?: {
    defaultTaxRate: number;
    defaultCurrency: string;
    paymentInstructions?: string | null;
    name?: string | null;
    businessName?: string | null;
    businessEmail?: string | null;
    businessAddress?: string | null;
    hstNumber?: string | null;
  };
}

export function InvoiceForm({
  clients,
  invoiceId,
  defaultClientId,
  defaultValues,
  userDefaults,
}: InvoiceFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      clientId: defaultClientId ?? defaultValues?.clientId ?? "",
      billingType: defaultValues?.billingType ?? "HOURLY",
      billingPeriodStart: defaultValues?.billingPeriodStart ?? "",
      billingPeriodEnd: defaultValues?.billingPeriodEnd ?? "",
      hoursWorked: defaultValues?.hoursWorked ?? null,
      hourlyRate: defaultValues?.hourlyRate ?? null,
      fixedAmount: defaultValues?.fixedAmount ?? null,
      taxRate: defaultValues?.taxRate ?? userDefaults?.defaultTaxRate ?? 0,
      currency: defaultValues?.currency ?? userDefaults?.defaultCurrency ?? "USD",
      dueDate: defaultValues?.dueDate ?? "",
      taskSummary: defaultValues?.taskSummary ?? "",
      notes: defaultValues?.notes ?? "",
      paymentInstructions:
        defaultValues?.paymentInstructions ??
        userDefaults?.paymentInstructions ??
        "",
      privateNotes: defaultValues?.privateNotes ?? "",
    },
  });

  // Watch fields for auto-calculations
  const selectedClientId = useWatch({ control, name: "clientId" });
  const billingType = useWatch({ control, name: "billingType" });
  const hoursWorked = useWatch({ control, name: "hoursWorked" });
  const hourlyRate = useWatch({ control, name: "hourlyRate" });
  const fixedAmount = useWatch({ control, name: "fixedAmount" });
  const taxRate = useWatch({ control, name: "taxRate" });
  const currency = useWatch({ control, name: "currency" });
  const billingPeriodStart = useWatch({ control, name: "billingPeriodStart" });
  const taskSummary = useWatch({ control, name: "taskSummary" });

  // Auto-fill from client selection
  useEffect(() => {
    if (!selectedClientId) return;
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    // Fill rate
    if (!invoiceId) {
      if (client.hourlyRate) {
        setValue("billingType", "HOURLY");
        setValue("hourlyRate", toDecimal(client.hourlyRate));
      } else if (client.fixedRate) {
        setValue("billingType", "FIXED");
        setValue("fixedAmount", toDecimal(client.fixedRate));
      }
      // Fill currency
      setValue("currency", client.currency);
      // Fill billing period
      if (client.billingCycle !== "CUSTOM") {
        const { start, end } = getBillingPeriodDates(client.billingCycle);
        setValue("billingPeriodStart", start.toISOString().split("T")[0]);
        setValue("billingPeriodEnd", end.toISOString().split("T")[0]);
      }
      // Fill payment instructions
      if (client.paymentInstructions) {
        setValue("paymentInstructions", client.paymentInstructions);
      }
      // Fill notes
      if (client.defaultNotes) {
        setValue("notes", client.defaultNotes);
      }
    }
  }, [selectedClientId, clients, setValue, invoiceId]);

  // Calculate totals
  const totals = calculateInvoiceTotals({
    billingType,
    hoursWorked: hoursWorked ? Number(hoursWorked) : null,
    hourlyRate: hourlyRate ? Number(hourlyRate) : null,
    fixedAmount: fixedAmount ? Number(fixedAmount) : null,
    taxRate: taxRate ? Number(taxRate) : 0,
  });

  async function onSubmit(data: InvoiceFormData) {
    setLoading(true);
    setError(null);
    try {
      const res = invoiceId
        ? await fetch(`/api/invoices/${invoiceId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          })
        : await fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Something went wrong");
      }

      const invoice = await res.json();
      router.push(`/invoices/${invoice.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const activeClients = clients.filter((c) => !c.isArchived);
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const userInitial = (userDefaults?.name ?? session?.user?.name ?? "U")?.[0]?.toUpperCase() ?? "U";
  const clientInitial = selectedClient?.name?.[0]?.toUpperCase() ?? "?";
  const displayName = userDefaults?.name ?? session?.user?.name ?? "My Business";
  const displayBusinessName = userDefaults?.businessName;
  const displayEmail = userDefaults?.businessEmail ?? session?.user?.email;
  const displayAddress = userDefaults?.businessAddress;
  const displayHst = userDefaults?.hstNumber;
  const issuedDateLabel = billingPeriodStart
    ? new Date(billingPeriodStart).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <form onSubmit={handleSubmit(onSubmit as any)}>
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Left: Invoice Card ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Card 1 — Business Info Banner */}
          <div className="bg-indigo-800 px-6 py-5 flex">
            {/* Left: name, company, email */}
            <div className="flex-1 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {userInitial}
              </div>
              <div className="space-y-0.5">
                <p className="text-white font-bold text-base leading-tight">{displayName}</p>
                {displayBusinessName && (
                  <p className="text-indigo-200 text-sm">{displayBusinessName}</p>
                )}
                {displayEmail && (
                  <p className="text-indigo-300 text-xs">{displayEmail}</p>
                )}
              </div>
            </div>
            {/* Right: address, HST */}
            {(displayAddress || displayHst) && (
              <div className="text-right space-y-0.5 shrink-0 pl-4">
                {displayAddress && (
                  <p className="text-indigo-200 text-xs whitespace-pre-line">{displayAddress}</p>
                )}
                {displayHst && (
                  <p className="text-indigo-300 text-xs">HST: {displayHst}</p>
                )}
              </div>
            )}
          </div>

          {/* Card 2 — Invoice meta */}
          <div className="flex divide-x divide-slate-200 border-b border-slate-200 bg-white">
            {/* Left: Invoice Number + date */}
            <div className="flex-1 px-6 py-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Invoice Number</p>
              <p className="text-sm font-semibold text-slate-800">—</p>
              {issuedDateLabel ? (
                <p className="text-xs text-slate-500 mt-1.5">Submitted on {issuedDateLabel}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1.5 italic">Submitted on —</p>
              )}
            </div>
            {/* Right: Billed to */}
            <div className="flex-1 px-6 py-5 text-right">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Billed to</p>
              {selectedClient ? (
                <>
                  <p className="text-sm font-semibold text-slate-800">{selectedClient.name}</p>
                  {selectedClient.companyName && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedClient.companyName}</p>
                  )}
                  {selectedClient.billingAddress && (
                    <p className="text-xs text-slate-400 mt-0.5">{selectedClient.billingAddress}</p>
                  )}
                  {selectedClient.email && (
                    <p className="text-xs text-slate-400 mt-0.5">{selectedClient.email}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">Select a client →</p>
              )}
            </div>
          </div>

          {/* Item Details */}
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-sm font-semibold text-slate-800">Item Details</h3>
            <p className="text-xs text-slate-400 mb-4">Details item with more info</p>

            {/* Table header */}
            <div className={`grid gap-2 pb-2 border-b border-slate-100 ${billingType === "HOURLY" ? "grid-cols-12" : "grid-cols-12"}`}>
              <div className="col-span-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Description
              </div>
              {billingType === "HOURLY" && (
                <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                  Hours
                </div>
              )}
              <div className={`${billingType === "HOURLY" ? "col-span-2" : "col-span-4"} text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right`}>
                Rate
              </div>
              <div className="col-span-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">
                Amount
              </div>
            </div>

            {/* Table row */}
            <div className="grid grid-cols-12 gap-2 py-4 border-b border-slate-100 items-center">
              {/* Description */}
              <div className="col-span-5">
                <Input
                  id="taskSummary"
                  placeholder="e.g. Frontend development – Sprint 12"
                  {...register("taskSummary")}
                  error={errors.taskSummary?.message}
                />
              </div>

              {/* Hours (HOURLY only) */}
              {billingType === "HOURLY" && (
                <div className="col-span-2">
                  <Input
                    id="hoursWorked"
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="0.00"
                    {...register("hoursWorked")}
                    error={errors.hoursWorked?.message}
                  />
                </div>
              )}

              {/* Rate / Fixed Amount */}
              <div className={billingType === "HOURLY" ? "col-span-2" : "col-span-4"}>
                {billingType === "HOURLY" ? (
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register("hourlyRate")}
                    error={errors.hourlyRate?.message}
                  />
                ) : (
                  <Input
                    id="fixedAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register("fixedAmount")}
                    error={errors.fixedAmount?.message}
                  />
                )}
              </div>

              {/* Amount (calculated) */}
              <div className="col-span-3 flex items-center justify-end h-9">
                <span className="text-sm font-semibold text-slate-800">
                  {formatCurrency(totals.subtotal, currency || "USD")}
                </span>
              </div>
            </div>

            {/* Add Item row */}
            <div className="py-3">
              <button
                type="button"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                + Add Item
              </button>
            </div>
          </div>

          {/* Totals — separated with strong border */}
          <div className="border-t-2 border-slate-100 px-6 py-5">
            <div className="max-w-[260px] ml-auto space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-800">{formatCurrency(totals.subtotal, currency || "USD")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Tax{Number(taxRate) > 0 ? ` (${taxRate}%)` : ""}
                </span>
                <span className={Number(taxRate) > 0 ? "font-medium text-slate-800" : "font-medium text-indigo-600"}>
                  {Number(taxRate) > 0 ? formatCurrency(totals.taxAmount, currency || "USD") : "Add"}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2.5">
                <span>Total</span>
                <span>{formatCurrency(totals.total, currency || "USD")}</span>
              </div>
            </div>
          </div>

          {/* Notes & Instructions */}
          <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4">
            <FormField label="Notes" error={errors.notes?.message} htmlFor="notes">
              <Textarea
                id="notes"
                rows={2}
                placeholder="Optional notes shown on the invoice…"
                {...register("notes")}
              />
            </FormField>
            <FormField
              label="Payment Instructions"
              error={errors.paymentInstructions?.message}
              htmlFor="paymentInstructions"
            >
              <Textarea
                id="paymentInstructions"
                rows={2}
                placeholder="Bank transfer, PayPal, etc."
                {...register("paymentInstructions")}
              />
            </FormField>
            <FormField
              label="Private Notes"
              error={errors.privateNotes?.message}
              htmlFor="privateNotes"
            >
              <Textarea
                id="privateNotes"
                rows={2}
                placeholder="Internal notes – not shown on the invoice…"
                {...register("privateNotes")}
              />
            </FormField>
          </div>
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="space-y-4">
          {/* Client Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Client Details</h3>

            {selectedClient && (
              <div className="mb-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {clientInitial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{selectedClient.name}</p>
                  {selectedClient.email && (
                    <p className="text-xs text-slate-500 truncate">{selectedClient.email}</p>
                  )}
                  {selectedClient.companyName && (
                    <p className="text-xs font-medium text-slate-600 mt-0.5">{selectedClient.companyName}</p>
                  )}
                  {selectedClient.billingAddress && (
                    <p className="text-xs text-slate-400 mt-0.5">{selectedClient.billingAddress}</p>
                  )}
                </div>
              </div>
            )}

            <FormField label="Select Client" required error={errors.clientId?.message} htmlFor="clientId">
              <Select id="clientId" {...register("clientId")}>
                <option value="">— Choose a client —</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName ? `${c.companyName} (${c.name})` : c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {/* Basic Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Basic Info</h3>

            <FormField
              label="Billing Type"
              required
              error={errors.billingType?.message}
              htmlFor="billingType"
            >
              <Select id="billingType" {...register("billingType")}>
                <option value="HOURLY">Hourly</option>
                <option value="FIXED">Fixed Price</option>
              </Select>
            </FormField>

            <FormField
              label="Invoice Date"
              error={errors.billingPeriodStart?.message}
              htmlFor="billingPeriodStart"
            >
              <Input id="billingPeriodStart" type="date" {...register("billingPeriodStart")} />
            </FormField>

            <FormField
              label="Period End"
              error={errors.billingPeriodEnd?.message}
              htmlFor="billingPeriodEnd"
            >
              <Input id="billingPeriodEnd" type="date" {...register("billingPeriodEnd")} />
            </FormField>

            <FormField label="Currency" required error={errors.currency?.message} htmlFor="currency">
              <Select id="currency" {...register("currency")}>
                {["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "INR"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Tax Rate (%)" error={errors.taxRate?.message} htmlFor="taxRate">
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                {...register("taxRate")}
              />
            </FormField>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <Button
              type="submit"
              loading={loading}
              size="lg"
              className="w-full justify-center h-12 text-base font-semibold"
            >
              {invoiceId ? "Save Changes" : "Create Invoice"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-center gap-2"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Preview Modal */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Invoice Preview"
        description="This is how your invoice will look"
        size="xl"
      >
        <DialogBody className="p-0">
          {/* Banner */}
          <div className="bg-indigo-800 px-8 py-5 flex">
            <div className="flex-1 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {userInitial}
              </div>
              <div className="space-y-0.5">
                <p className="text-white font-bold text-base leading-tight">{displayName}</p>
                {displayBusinessName && <p className="text-indigo-200 text-sm">{displayBusinessName}</p>}
                {displayEmail && <p className="text-indigo-300 text-xs">{displayEmail}</p>}
              </div>
            </div>
            {(displayAddress || displayHst) && (
              <div className="text-right space-y-0.5 shrink-0 pl-4">
                {displayAddress && <p className="text-indigo-200 text-xs whitespace-pre-line">{displayAddress}</p>}
                {displayHst && <p className="text-indigo-300 text-xs">HST: {displayHst}</p>}
              </div>
            )}
          </div>

          {/* Invoice meta */}
          <div className="flex divide-x divide-slate-200 border-b border-slate-200">
            <div className="flex-1 px-8 py-5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Invoice Number</p>
              <p className="text-sm font-semibold text-slate-800">#DRAFT</p>
              {issuedDateLabel ? (
                <p className="text-xs text-slate-500 mt-1">Submitted on {issuedDateLabel}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1 italic">Submitted on —</p>
              )}
            </div>
            <div className="flex-1 px-8 py-5 text-right">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Billed to</p>
              {selectedClient ? (
                <>
                  <p className="text-sm font-semibold text-slate-800">{selectedClient.name}</p>
                  {selectedClient.companyName && <p className="text-xs text-slate-500 mt-0.5">{selectedClient.companyName}</p>}
                  {selectedClient.billingAddress && <p className="text-xs text-slate-400 mt-0.5">{selectedClient.billingAddress}</p>}
                  {selectedClient.email && <p className="text-xs text-slate-400 mt-0.5">{selectedClient.email}</p>}
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">No client selected</p>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="px-8 pt-6 pb-4">
            <div className="grid grid-cols-12 pb-2 border-b border-slate-100">
              <div className="col-span-5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</div>
              {billingType === "HOURLY" && <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">Hours</div>}
              <div className={`${billingType === "HOURLY" ? "col-span-2" : "col-span-4"} text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right`}>Rate</div>
              <div className="col-span-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</div>
            </div>
            <div className="grid grid-cols-12 py-4 border-b border-slate-100 items-center">
              <div className="col-span-5 text-sm text-slate-700">
                {taskSummary || <span className="italic text-slate-400">No description</span>}
              </div>
              {billingType === "HOURLY" && <div className="col-span-2 text-sm text-slate-700 text-center">{hoursWorked ?? "—"}</div>}
              <div className={`${billingType === "HOURLY" ? "col-span-2" : "col-span-4"} text-sm text-slate-700 text-right`}>
                {billingType === "HOURLY"
                  ? hourlyRate ? formatCurrency(Number(hourlyRate), currency || "USD") : "—"
                  : fixedAmount ? formatCurrency(Number(fixedAmount), currency || "USD") : "—"}
              </div>
              <div className="col-span-3 text-sm font-semibold text-slate-800 text-right">{formatCurrency(totals.subtotal, currency || "USD")}</div>
            </div>
          </div>

          {/* Totals */}
          <div className="px-8 pb-6">
            <div className="max-w-[240px] ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-800">{formatCurrency(totals.subtotal, currency || "USD")}</span>
              </div>
              {Number(taxRate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax ({taxRate}%)</span>
                  <span className="font-medium text-slate-800">{formatCurrency(totals.taxAmount, currency || "USD")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total</span>
                <span>{formatCurrency(totals.total, currency || "USD")}</span>
              </div>
            </div>
          </div>
        </DialogBody>
      </Dialog>
    </form>
  );
}
