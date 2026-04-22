import { PrismaClient, InvoiceStatus, BillingCycle, BillingType } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import "dotenv/config";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Demo user — update email to match your Google account if you want to log in
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    create: {
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
      defaultEmailSubject:
        "Invoice {{invoiceNumber}} from {{businessName}}",
      defaultEmailBody: `Hi {{clientName}},

Please find attached invoice {{invoiceNumber}} for {{amount}}, due on {{dueDate}}.

Billing period: {{billingPeriod}}

Thank you for your business!

Best,
Alex
{{businessName}}`,
    },
    update: {},
  });

  console.log(`Created user: ${user.email}`);

  // Clients
  const acme = await prisma.client.upsert({
    where: { id: "seed-client-acme" },
    create: {
      id: "seed-client-acme",
      userId: user.id,
      name: "Sarah Johnson",
      companyName: "Acme Corp",
      email: "sarah@acmecorp.com",
      billingAddress: "456 Business Ave\nNew York, NY 10001",
      billingCycle: BillingCycle.MONTHLY,
      hourlyRate: 120,
      currency: "USD",
      paymentTerms: "Net 30",
    },
    update: {},
  });

  const techStartup = await prisma.client.upsert({
    where: { id: "seed-client-tech" },
    create: {
      id: "seed-client-tech",
      userId: user.id,
      name: "Mike Chen",
      companyName: "Tech Startup Inc",
      email: "mike@techstartup.io",
      billingAddress: "789 Innovation Blvd\nAustin, TX 73301",
      billingCycle: BillingCycle.BIWEEKLY,
      hourlyRate: 150,
      currency: "USD",
      paymentTerms: "Net 14",
    },
    update: {},
  });

  const designAgency = await prisma.client.upsert({
    where: { id: "seed-client-design" },
    create: {
      id: "seed-client-design",
      userId: user.id,
      name: "Emma Davis",
      companyName: "Creative Agency LLC",
      email: "emma@creativeagency.co",
      billingCycle: BillingCycle.CUSTOM,
      fixedRate: 2500,
      currency: "USD",
      paymentTerms: "Due on receipt",
    },
    update: {},
  });

  console.log("Created clients");

  // Helper
  function inv(
    userId: string,
    clientId: string,
    num: string,
    status: InvoiceStatus,
    billingType: BillingType,
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

    const period = (() => {
      const start = startOfMonth(subMonths(new Date(), Math.floor(opts.daysAgo / 30)));
      const end = endOfMonth(start);
      return { start, end };
    })();

    return prisma.invoice.create({
      data: {
        userId,
        clientId,
        invoiceNumber: num,
        status,
        billingType,
        hoursWorked: billingType === "HOURLY" ? opts.hoursWorked : null,
        hourlyRate: billingType === "HOURLY" ? opts.hourlyRate : null,
        fixedAmount: billingType === "FIXED" ? opts.fixedAmount : null,
        subtotal,
        taxRate,
        taxAmount,
        total,
        currency: "USD",
        taskSummary: opts.taskSummary ?? "Professional Services",
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
        createdAt,
        dueDate: opts.dueDays
          ? new Date(createdAt.getTime() + opts.dueDays * 86400_000)
          : null,
        paidAt:
          status === "PAID" && opts.paidDaysAgo != null
            ? subDays(new Date(), opts.paidDaysAgo)
            : null,
      },
    });
  }

  // Invoices for Acme Corp
  await inv(user.id, acme.id, "INV-2024-001", "PAID", "HOURLY", {
    hoursWorked: 40, hourlyRate: 120, daysAgo: 90, dueDays: 30, paidDaysAgo: 55,
    taskSummary: "Website redesign — June",
  });
  await inv(user.id, acme.id, "INV-2024-002", "PAID", "HOURLY", {
    hoursWorked: 38, hourlyRate: 120, daysAgo: 60, dueDays: 30, paidDaysAgo: 25,
    taskSummary: "Website redesign — July",
  });
  await inv(user.id, acme.id, "INV-2024-003", "SENT", "HOURLY", {
    hoursWorked: 42, hourlyRate: 120, daysAgo: 30, dueDays: 30,
    taskSummary: "Website redesign — August",
  });

  // Invoices for Tech Startup
  await inv(user.id, techStartup.id, "INV-2024-004", "PAID", "HOURLY", {
    hoursWorked: 20, hourlyRate: 150, daysAgo: 75, dueDays: 14, paidDaysAgo: 58,
    taskSummary: "Sprint 12 — API development",
  });
  await inv(user.id, techStartup.id, "INV-2024-005", "PAID", "HOURLY", {
    hoursWorked: 22, hourlyRate: 150, daysAgo: 45, dueDays: 14, paidDaysAgo: 28,
    taskSummary: "Sprint 13 — Dashboard UI",
  });
  await inv(user.id, techStartup.id, "INV-2024-006", "OVERDUE", "HOURLY", {
    hoursWorked: 18, hourlyRate: 150, daysAgo: 45, dueDays: 14,
    taskSummary: "Sprint 14 — Authentication",
  });

  // Invoices for Design Agency
  await inv(user.id, designAgency.id, "INV-2024-007", "PAID", "FIXED", {
    fixedAmount: 2500, daysAgo: 50, dueDays: 7, paidDaysAgo: 40,
    taskSummary: "Logo design package",
  });
  await inv(user.id, designAgency.id, "INV-2024-008", "DRAFT", "FIXED", {
    fixedAmount: 1800, daysAgo: 3, dueDays: 7,
    taskSummary: "Brand guidelines document",
  });

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
  .finally(() => prisma.$disconnect());
