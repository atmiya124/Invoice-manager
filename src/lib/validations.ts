import { z } from "zod";

// ─── Client ───────────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  companyName: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  billingAddress: z.string().optional(),
  hourlyRate: z.coerce.number().min(0).optional().nullable(),
  fixedRate: z.coerce.number().min(0).optional().nullable(),
  billingCycle: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"]),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  currency: z.string().min(1, "Currency is required"),
  defaultNotes: z.string().optional(),
  emailTemplate: z.string().optional(),
  paymentInstructions: z.string().optional(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// ─── Invoice ──────────────────────────────────────────────────────────────────

export const invoiceSchema = z
  .object({
    clientId: z.string().min(1, "Client is required"),
    billingType: z.enum(["HOURLY", "FIXED"]),
    billingPeriodStart: z.string().optional().nullable(),
    billingPeriodEnd: z.string().optional().nullable(),
    hoursWorked: z.coerce.number().min(0).optional().nullable(),
    hourlyRate: z.coerce.number().min(0).optional().nullable(),
    fixedAmount: z.coerce.number().min(0).optional().nullable(),
    taxRate: z.coerce.number().min(0).max(100).default(0),
    currency: z.string().min(1, "Currency is required"),
    dueDate: z.string().optional().nullable(),
    taskSummary: z.string().optional(),
    notes: z.string().optional(),
    paymentInstructions: z.string().optional(),
    privateNotes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.billingType === "HOURLY") {
        return data.hoursWorked != null && data.hourlyRate != null;
      }
      return data.fixedAmount != null && data.fixedAmount > 0;
    },
    {
      message: "Please provide hours & rate (hourly) or a fixed amount",
      path: ["billingType"],
    }
  );

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  businessName: z.string().optional(),
  businessEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  hstNumber: z.string().optional(),
  invoicePrefix: z.string().min(1, "Prefix is required").max(10),
  defaultPaymentTerms: z.string().min(1, "Payment terms required"),
  defaultTaxRate: z.coerce.number().min(0).max(100).default(0),
  defaultCurrency: z.string().min(1, "Currency is required"),
  paymentInstructions: z.string().optional(),
  defaultEmailSubject: z.string().min(1, "Email subject is required"),
  defaultEmailBody: z.string().min(1, "Email body is required"),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;

// ─── Send Email ───────────────────────────────────────────────────────────────

export const sendEmailSchema = z.object({
  invoiceId: z.string().min(1),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});

export type SendEmailFormData = z.infer<typeof sendEmailSchema>;
