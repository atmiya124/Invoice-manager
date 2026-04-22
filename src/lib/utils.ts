import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import type { BillingCycle } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string {
  if (!start && !end) return "—";
  if (!start) return `Until ${formatDate(end)}`;
  if (!end) return `From ${formatDate(start)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function getBillingPeriodDates(
  cycle: BillingCycle,
  referenceDate: Date = new Date()
): { start: Date; end: Date } {
  switch (cycle) {
    case "WEEKLY":
      return {
        start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
        end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
      };
    case "BIWEEKLY":
      return {
        start: subDays(referenceDate, 14),
        end: referenceDate,
      };
    case "MONTHLY":
      return {
        start: startOfMonth(referenceDate),
        end: endOfMonth(referenceDate),
      };
    default:
      return {
        start: startOfMonth(referenceDate),
        end: endOfMonth(referenceDate),
      };
  }
}

export function generateInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number
): string {
  return `${prefix}-${year}-${String(sequence).padStart(3, "0")}`;
}

export function calculateInvoiceTotals(params: {
  billingType: "HOURLY" | "FIXED";
  hoursWorked?: number | null;
  hourlyRate?: number | null;
  fixedAmount?: number | null;
  taxRate: number;
}): { subtotal: number; taxAmount: number; total: number } {
  const { billingType, hoursWorked, hourlyRate, fixedAmount, taxRate } = params;

  let subtotal = 0;
  if (billingType === "HOURLY" && hoursWorked && hourlyRate) {
    subtotal = hoursWorked * hourlyRate;
  } else if (billingType === "FIXED" && fixedAmount) {
    subtotal = fixedAmount;
  }

  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function interpolateEmailTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export function getBillingCycleLabel(cycle: BillingCycle): string {
  const labels: Record<BillingCycle, string> = {
    WEEKLY: "Weekly",
    BIWEEKLY: "Biweekly",
    MONTHLY: "Monthly",
    CUSTOM: "Custom",
  };
  return labels[cycle] ?? cycle;
}

export function toDecimal(value: unknown): number {
  if (value === null || value === undefined) return 0;
  // Prisma Decimal objects have a toString() method
  return parseFloat(String(value));
}
