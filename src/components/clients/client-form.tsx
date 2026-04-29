"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Client } from "@/types";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "INR"];
const BILLING_CYCLES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom" },
];

interface ClientFormProps {
  defaultValues?: Partial<Client>;
  clientId?: string;
}

export function ClientForm({ defaultValues, clientId }: ClientFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      companyName: defaultValues?.companyName ?? "",
      email: defaultValues?.email ?? "",
      billingAddress: defaultValues?.billingAddress ?? "",
      hourlyRate: defaultValues?.hourlyRate
        ? Number(defaultValues.hourlyRate)
        : undefined,
      fixedRate: defaultValues?.fixedRate
        ? Number(defaultValues.fixedRate)
        : undefined,
      billingCycle: defaultValues?.billingCycle ?? "MONTHLY",
      paymentTerms: defaultValues?.paymentTerms ?? "Net 30",
      currency: defaultValues?.currency ?? "USD",
      defaultNotes: defaultValues?.defaultNotes ?? "",
      emailTemplate: defaultValues?.emailTemplate ?? "",
      paymentInstructions: defaultValues?.paymentInstructions ?? "",
      invoiceStartNumber: defaultValues?.invoiceStartNumber ?? 1,
    },
  });

  async function onSubmit(data: ClientFormData) {
    setLoading(true);
    setError(null);
    try {
      const res = clientId
        ? await fetch(`/api/clients/${clientId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          })
        : await fetch("/api/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Something went wrong");
      }

      const client = await res.json();
      router.push(`/clients/${client.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Contact Details */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
          Contact Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Company Name" required error={errors.companyName?.message} htmlFor="companyName">
            <Input id="companyName" {...register("companyName")} error={errors.companyName?.message} />
          </FormField>
          <FormField label="Contact Person" error={errors.name?.message} htmlFor="name">
            <Input id="name" {...register("name")} placeholder="Optional" />
          </FormField>
          <FormField label="Email Address" error={errors.email?.message} htmlFor="email">
            <Input id="email" type="email" {...register("email")} error={errors.email?.message} />
          </FormField>
          <FormField label="Billing Address" error={errors.billingAddress?.message} htmlFor="billingAddress">
            <Input id="billingAddress" {...register("billingAddress")} />
          </FormField>
        </div>
      </section>

      {/* Billing Defaults */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
          Billing Defaults
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Invoice Start Number" error={errors.invoiceStartNumber?.message} htmlFor="invoiceStartNumber">
            <Input
              id="invoiceStartNumber"
              type="number"
              min="1"
              placeholder="1"
              {...register("invoiceStartNumber")}
            />
          </FormField>
          <FormField label="Hourly Rate" error={errors.hourlyRate?.message} htmlFor="hourlyRate">
            <Input
              id="hourlyRate"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register("hourlyRate")}
            />
          </FormField>
          <FormField label="Fixed Rate" error={errors.fixedRate?.message} htmlFor="fixedRate">
            <Input
              id="fixedRate"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register("fixedRate")}
            />
          </FormField>
          <FormField label="Billing Cycle" required error={errors.billingCycle?.message} htmlFor="billingCycle">
            <Select id="billingCycle" {...register("billingCycle")}>
              {BILLING_CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Payment Terms" required error={errors.paymentTerms?.message} htmlFor="paymentTerms">
            <Select id="paymentTerms" {...register("paymentTerms")}>
              <option value="Due on receipt">Due on receipt</option>
              <option value="Net 7">Net 7</option>
              <option value="Net 14">Net 14</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 45">Net 45</option>
              <option value="Net 60">Net 60</option>
            </Select>
          </FormField>
          <FormField label="Currency" required error={errors.currency?.message} htmlFor="currency">
            <Select id="currency" {...register("currency")}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      {/* Notes & Email */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
          Defaults & Notes
        </h2>
        <div className="grid gap-4">
          <FormField label="Payment Instructions" error={errors.paymentInstructions?.message} htmlFor="paymentInstructions">
            <Textarea
              id="paymentInstructions"
              rows={2}
              placeholder="e.g. Please transfer to bank account XYZ…"
              {...register("paymentInstructions")}
            />
          </FormField>
          <FormField label="Default Invoice Notes" error={errors.defaultNotes?.message} htmlFor="defaultNotes">
            <Textarea
              id="defaultNotes"
              rows={2}
              placeholder="Default notes appended to invoices for this client…"
              {...register("defaultNotes")}
            />
          </FormField>
          <FormField
            label="Custom Email Template"
            error={errors.emailTemplate?.message}
            htmlFor="emailTemplate"
          >
            <Textarea
              id="emailTemplate"
              rows={4}
              placeholder="Leave blank to use your default email template. Use {{invoiceNumber}}, {{total}}, {{dueDate}}, etc."
              {...register("emailTemplate")}
            />
          </FormField>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" loading={loading}>
          {clientId ? "Save Changes" : "Create Client"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
