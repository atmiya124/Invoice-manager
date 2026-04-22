import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../src/lib/schema";
import { users, clients as clientsTable, invoices as invoicesTable } from "../src/lib/schema";
import { eq } from "drizzle-orm";
import { subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import "dotenv/config";

const client = createClient({ url: process.env.DATABASE_URL! });
const db = drizzle(client, { schema });

async function main() {
  console.log("Seeding database...");

  // Demo user
  await db.insert(users).values({
    email: "demo@example.com",
    name: "Alex Freelancer",
    businessName: "Alex Design Studio",
    businessEmail: "alex@designstudio.dev",
    businessAddress: "123 Creative St\nSan Francisco, CA 94105",
    defaultCurrency: "USD",
    defaultTaxRate: 0,
    defaultPaymentTerms: "Net 30",
    paymentInstructions:
      "Bank transfer to:\nRouting: 021000021\nAccount: 12345678\n\nor PayPal: alex@designstudio.dev",
    defaultEmailSubject: "Invoice {{invoiceNumber}} from {{businessName}}",
    defaultEmailBody: `Hi {{clientName}},\n\nPlease find attached invoice {{invoiceNumber}} for {{amount}}, due on {{dueDate}}.\n\nBilling period: {{billingPeriod}}\n\nThank you for your business!\n\nBest,\nAlex\n{{businessName}}`,
  }).onConflictDoNothing();

  const user = await db.query.users.findFirst({
    where: eq(users.email, "demo@example.com"),
  });
  if (!user) throw new Error("Failed to find/create demo user");

  console.log(`Created user: ${user.email}`);

  // Clients
  await db.insert(clientsTable).values([
    {
      id: "seed-client-acme",
      userId: user.id,
      name: "Sarah Johnson",
      companyName: "Acme Corp",
      email: "sarah@acmecorp.com",
      billingAddress: "456 Business Ave\nNew York, NY 10001",
      billingCycle: "MONTHLY",
      hourlyRate: 120,
      currency: "USD",
      paymentTerms: "Net 30",
    },
    {
      id: "seed-client-tech",
      userId: user.id,
      name: "Mike Chen",
      companyName: "Tech Startup Inc",
      email: "mike@techstartup.io",
      billingAddress: "789 Innovation Blvd\nAustin, TX 73301",
      billingCycle: "BIWEEKLY",
      hourlyRate: 150,
      currency: "USD",
      paymentTerms: "Net 14",
    },
    {
      id: "seed-client-design",
      userId: user.id,
      name: "Emma Davis",
      companyName: "Creative Agency LLC",
      email: "emma@creativeagency.co",
      billingCycle: "CUSTOM",
      fixedRate: 2500,
      currency: "USD",
      paymentTerms: "Due on receipt",
    },
  ]).onConflictDoNothing();

  console.log("Created clients");

  // Helper to build invoice data
  function makeInvoice(
    userId: string,
    clientId: string,
    num: string,
    status: "DRAFT" | "SENT" | "PAID" | "OVERDUE",
    billingType: "HOURLY" | "FIXED",
    opts: {
      hoursWorked?: number;
      hourlyRate?: number;
      fixedAmount?: number;
      daysAgo: number;
      dueDays?: number;
      paidDaysAgo?: number;
      taskSummary?: string;
      taxRate?: number;
    }
  ) {
    const subtotal =
      billingType === "HOURLY"
        ? (opts.hoursWorked ?? 0) * (opts.hourlyRate ?? 0)
        : (opts.fixedAmount ?? 0);
    const taxRate = opts.taxRate ?? 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    const createdAt = subDays(new Date(), opts.daysAgo);
    const periodBase = subMonths(new Date(), Math.floor(opts.daysAgo / 30));
    const periodStart = startOfMonth(periodBase);
    const periodEnd = endOfMonth(periodBase);

    return {
      userId,
      clientId,
      invoiceNumber: num,
      status,
      billingType,
      hoursWorked: billingType === "HOURLY" ? (opts.hoursWorked ?? null) : null,
      hourlyRate: billingType === "HOURLY" ? (opts.hourlyRate ?? null) : null,
      fixedAmount: billingType === "FIXED" ? (opts.fixedAmount ?? null) : null,
      subtotal,
      taxRate,
      taxAmount,
      total,
      currency: "USD",
      taskSummary: opts.taskSummary ?? "Professional Services",
      billingPeriodStart: periodStart.toISOString(),
      billingPeriodEnd: periodEnd.toISOString(),
      createdAt: createdAt.toISOString(),
      dueDate: opts.dueDays
        ? new Date(createdAt.getTime() + opts.dueDays * 86_400_000).toISOString()
        : null,
      paidAt:
        status === "PAID" && opts.paidDaysAgo != null
          ? subDays(new Date(), opts.paidDaysAgo).toISOString()
          : null,
    };
  }

  await db.insert(invoicesTable).values([
    makeInvoice(user.id, "seed-client-acme", "INV-2024-001", "PAID", "HOURLY", {
      hoursWorked: 40, hourlyRate: 120, daysAgo: 90, dueDays: 30, paidDaysAgo: 55,
      taskSummary: "Website redesign — June",
    }),
    makeInvoice(user.id, "seed-client-acme", "INV-2024-002", "PAID", "HOURLY", {
      hoursWorked: 38, hourlyRate: 120, daysAgo: 60, dueDays: 30, paidDaysAgo: 25,
      taskSummary: "Website redesign — July",
    }),
    makeInvoice(user.id, "seed-client-acme", "INV-2024-003", "SENT", "HOURLY", {
      hoursWorked: 42, hourlyRate: 120, daysAgo: 30, dueDays: 30,
      taskSummary: "Website redesign — August",
    }),
    makeInvoice(user.id, "seed-client-tech", "INV-2024-004", "PAID", "HOURLY", {
      hoursWorked: 20, hourlyRate: 150, daysAgo: 75, dueDays: 14, paidDaysAgo: 58,
      taskSummary: "Sprint 12 — API development",
    }),
    makeInvoice(user.id, "seed-client-tech", "INV-2024-005", "PAID", "HOURLY", {
      hoursWorked: 22, hourlyRate: 150, daysAgo: 45, dueDays: 14, paidDaysAgo: 28,
      taskSummary: "Sprint 13 — Dashboard UI",
    }),
    makeInvoice(user.id, "seed-client-tech", "INV-2024-006", "OVERDUE", "HOURLY", {
      hoursWorked: 18, hourlyRate: 150, daysAgo: 45, dueDays: 14,
      taskSummary: "Sprint 14 — Authentication",
    }),
    makeInvoice(user.id, "seed-client-design", "INV-2024-007", "PAID", "FIXED", {
      fixedAmount: 2500, daysAgo: 50, dueDays: 7, paidDaysAgo: 40,
      taskSummary: "Logo design package",
    }),
    makeInvoice(user.id, "seed-client-design", "INV-2024-008", "DRAFT", "FIXED", {
      fixedAmount: 1800, daysAgo: 3, dueDays: 7,
      taskSummary: "Brand guidelines document",
    }),
  ]).onConflictDoNothing();

  console.log("Created invoices");
  console.log("\nDone! Summary:");
  console.log("  1 demo user (demo@example.com)");
  console.log("  3 clients");
  console.log("  8 invoices (PAID, SENT, OVERDUE, DRAFT)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
