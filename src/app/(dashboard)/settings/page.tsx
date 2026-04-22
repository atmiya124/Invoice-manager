"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsSchema } from "@/lib/validations";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FormField, FieldError } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";

type SettingsData = z.infer<typeof settingsSchema>;

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CHF", "NZD"];
const PAYMENT_TERMS = [
  "Due on receipt",
  "Net 7",
  "Net 14",
  "Net 30",
  "Net 45",
  "Net 60",
];

const TEMPLATE_VARS = [
  { variable: "{{invoiceNumber}}", desc: "Invoice number" },
  { variable: "{{clientName}}", desc: "Client name" },
  { variable: "{{amount}}", desc: "Total amount" },
  { variable: "{{dueDate}}", desc: "Due date" },
  { variable: "{{billingPeriod}}", desc: "Billing period" },
  { variable: "{{businessName}}", desc: "Your business name" },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsData>({
    resolver: zodResolver(settingsSchema) as any,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        reset({
          name: data.name ?? "",
          businessName: data.businessName ?? "",
          businessEmail: data.businessEmail ?? "",
          businessAddress: data.businessAddress ?? "",
          businessPhone: data.businessPhone ?? "",
          hstNumber: data.hstNumber ?? "",
          invoicePrefix: data.invoicePrefix ?? "INV-",
          defaultCurrency: data.defaultCurrency ?? "CAD",
          defaultTaxRate: data.defaultTaxRate ?? 0,
          defaultPaymentTerms: data.defaultPaymentTerms ?? "Net 30",
          paymentInstructions: data.paymentInstructions ?? "",
          defaultEmailSubject:
            data.defaultEmailSubject ||
            "Invoice {{invoiceNumber}} – {{period}}",
          defaultEmailBody:
            data.defaultEmailBody ||
            "Hi {{clientName}},\n\nPlease find attached invoice {{invoiceNumber}} for the period {{period}}.\n\nAmount due: {{total}}\nDue date: {{dueDate}}\n\n{{paymentInstructions}}\n\nThank you for your business!\n{{senderName}}",
        });
        setGmailConnected(data.gmailConnected ?? false);
      })
      .finally(() => setLoading(false));
  }, [reset]);

  async function onSubmit(data: SettingsData) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSavedAt(new Date());
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error ?? `Save failed (${res.status})`);
      }
    } catch {
      setSaveError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6 max-w-2xl">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Your Name" htmlFor="name">
            <Input
              id="name"
              {...register("name")}
              placeholder="Jane Smith"
              error={errors.name?.message}
            />
            <FieldError message={errors.name?.message} />
          </FormField>
        </CardContent>
      </Card>

      {/* Business details */}
      <Card>
        <CardHeader>
          <CardTitle>Business Details</CardTitle>
          <p className="text-sm text-slate-500">
            Shown on your invoices and emails.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Business Name" htmlFor="businessName">
            <Input
              id="businessName"
              {...register("businessName")}
              placeholder="Acme Freelancing"
              error={errors.businessName?.message}
            />
            <FieldError message={errors.businessName?.message} />
          </FormField>

          <FormField label="Business Email" htmlFor="businessEmail">
            <Input
              id="businessEmail"
              type="email"
              {...register("businessEmail")}
              placeholder="you@yourcompany.com"
              error={errors.businessEmail?.message}
            />
            <FieldError message={errors.businessEmail?.message} />
          </FormField>

          <FormField label="Business Phone" htmlFor="businessPhone">
            <Input
              id="businessPhone"
              type="tel"
              {...register("businessPhone")}
              placeholder="+1 555 000 0000"
              error={errors.businessPhone?.message}
            />
            <FieldError message={errors.businessPhone?.message} />
          </FormField>

          <FormField label="HST / Tax Number" htmlFor="hstNumber">
            <Input
              id="hstNumber"
              {...register("hstNumber")}
              placeholder="123456789 RT0001"
              error={(errors as any).hstNumber?.message}
            />
            <FieldError message={(errors as any).hstNumber?.message} />
          </FormField>

          <FormField label="Business Address" htmlFor="businessAddress">
            <Textarea
              id="businessAddress"
              {...register("businessAddress")}
              rows={3}
              placeholder="123 Main St&#10;City, State 12345"
            />
            <FieldError message={errors.businessAddress?.message} />
          </FormField>
        </CardContent>
      </Card>

      {/* Invoice defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Defaults</CardTitle>
          <p className="text-sm text-slate-500">
            Applied to new invoices unless overridden by client settings.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Invoice Number Prefix" htmlFor="invoicePrefix">
            <Input
              id="invoicePrefix"
              {...register("invoicePrefix")}
              placeholder="INV-"
              maxLength={10}
              error={errors.invoicePrefix?.message}
            />
            <FieldError message={errors.invoicePrefix?.message} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Default Currency" htmlFor="defaultCurrency">
              <Select id="defaultCurrency" {...register("defaultCurrency")}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.defaultCurrency?.message} />
            </FormField>

            <FormField label="Default Tax Rate (%)" htmlFor="defaultTaxRate">
              <Input
                id="defaultTaxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("defaultTaxRate", { valueAsNumber: true })}
                placeholder="0"
                error={errors.defaultTaxRate?.message}
              />
              <FieldError message={errors.defaultTaxRate?.message} />
            </FormField>
          </div>

          <FormField label="Default Payment Terms" htmlFor="defaultPaymentTerms">
            <Select id="defaultPaymentTerms" {...register("defaultPaymentTerms")}>
              {PAYMENT_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Payment Instructions"
            htmlFor="paymentInstructions"
          >
            <Textarea
              id="paymentInstructions"
              {...register("paymentInstructions")}
              rows={4}
              placeholder="Bank: IBAN / Routing number&#10;PayPal: you@example.com"
            />
            <p className="text-xs text-slate-400 mt-1">
              Printed at the bottom of every invoice.
            </p>
          </FormField>
        </CardContent>
      </Card>

      {/* Email templates */}
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <p className="text-sm text-slate-500">
            Default subject and body when sending invoices. You can edit per-send.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Email Subject" htmlFor="defaultEmailSubject">
            <Input
              id="defaultEmailSubject"
              {...register("defaultEmailSubject")}
              placeholder="Invoice {{invoiceNumber}} from {{businessName}}"
              error={errors.defaultEmailSubject?.message}
            />
          </FormField>

          <FormField label="Email Body" htmlFor="defaultEmailBody">
            <Textarea
              id="defaultEmailBody"
              {...register("defaultEmailBody")}
              rows={8}
              placeholder={`Hi {{clientName}},\n\nPlease find attached invoice {{invoiceNumber}} for {{amount}}, due {{dueDate}}.\n\nThank you for your business.\n\n{{businessName}}`}
            />
          </FormField>

          {/* Template variables reference */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Available Variables
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {TEMPLATE_VARS.map(({ variable, desc }) => (
                <div key={variable} className="flex items-baseline gap-1.5 text-xs">
                  <code className="rounded bg-white border border-slate-200 px-1.5 py-0.5 font-mono text-indigo-600">
                    {variable}
                  </code>
                  <span className="text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gmail status */}
      <Card>
        <CardHeader>
          <CardTitle>Gmail Integration</CardTitle>
        </CardHeader>
        <CardContent>
          {gmailConnected ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              Gmail connected as{" "}
              <span className="font-medium">{session?.user?.email}</span>. Ready
              to send invoices.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Gmail not connected. Sign out and sign in again with Google to
              grant Gmail access.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-4 pb-8">
        <Button type="submit" loading={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
        {savedAt && !saveError && (
          <span className="text-sm text-emerald-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> Saved at{" "}
            {savedAt.toLocaleTimeString()}
          </span>
        )}
        {saveError && (
          <span className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> {saveError}
          </span>
        )}
      </div>
    </form>
  );
}
