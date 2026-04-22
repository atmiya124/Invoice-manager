import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, clients, users } from "@/lib/schema";
import { invoiceSchema } from "@/lib/validations";
import { calculateInvoiceTotals, generateInvoiceNumber } from "@/lib/utils";
import { NextRequest } from "next/server";
import { and, eq, desc, inArray, count, like } from "drizzle-orm";
import { isAfter } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "DRAFT" | "SENT" | "PAID" | "OVERDUE" | null;
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");

  const results = await db.query.invoices.findMany({
    where: and(
      eq(invoices.userId, session.user.id),
      status ? eq(invoices.status, status) : undefined,
      clientId ? eq(invoices.clientId, clientId) : undefined
    ),
    with: {
      client: {
        columns: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          billingAddress: true,
          currency: true,
        },
      },
    },
    orderBy: desc(invoices.createdAt),
  });

  const filtered = search
    ? results.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          inv.client.name.toLowerCase().includes(search.toLowerCase()) ||
          (inv.client.companyName?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : results;

  // Auto-mark overdue
  const now = new Date();
  const toMarkOverdue = filtered
    .filter(
      (inv) =>
        inv.status === "SENT" &&
        inv.dueDate &&
        isAfter(now, new Date(inv.dueDate))
    )
    .map((inv) => inv.id);

  if (toMarkOverdue.length > 0) {
    await db
      .update(invoices)
      .set({ status: "OVERDUE", updatedAt: new Date().toISOString() })
      .where(inArray(invoices.id, toMarkOverdue));
  }

  const response = filtered.map((inv) => ({
    ...inv,
    status: toMarkOverdue.includes(inv.id) ? ("OVERDUE" as const) : inv.status,
  }));

  return Response.json(response);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const data = parsed.data;

  // Verify client belongs to user
  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, data.clientId), eq(clients.userId, session.user.id)),
  });
  if (!client) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  // Generate invoice number
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { invoicePrefix: true },
  });
  const prefix = user?.invoicePrefix ?? "INV";
  const year = new Date().getFullYear();
  const [{ n }] = await db
    .select({ n: count() })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, session.user.id),
        like(invoices.invoiceNumber, `${prefix}-${year}-%`)
      )
    );

  const invoiceNumber = generateInvoiceNumber(prefix, year, n + 1);

  // Calculate totals
  const totals = calculateInvoiceTotals({
    billingType: data.billingType,
    hoursWorked: data.hoursWorked ?? null,
    hourlyRate: data.hourlyRate ?? null,
    fixedAmount: data.fixedAmount ?? null,
    taxRate: data.taxRate ?? 0,
  });

  const [invoice] = await db
    .insert(invoices)
    .values({
      userId: session.user.id,
      clientId: data.clientId,
      invoiceNumber,
      billingType: data.billingType,
      billingPeriodStart: data.billingPeriodStart ?? null,
      billingPeriodEnd: data.billingPeriodEnd ?? null,
      hoursWorked: data.hoursWorked ?? null,
      hourlyRate: data.hourlyRate ?? null,
      fixedAmount: data.fixedAmount ?? null,
      subtotal: totals.subtotal,
      taxRate: data.taxRate ?? 0,
      taxAmount: totals.taxAmount,
      total: totals.total,
      currency: data.currency,
      dueDate: data.dueDate ?? null,
      taskSummary: data.taskSummary ?? null,
      notes: data.notes ?? null,
      paymentInstructions: data.paymentInstructions ?? null,
      privateNotes: data.privateNotes ?? null,
    })
    .returning();

  const invoiceWithClient = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoice.id),
    with: {
      client: {
        columns: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          billingAddress: true,
          currency: true,
        },
      },
    },
  });

  return Response.json(invoiceWithClient, { status: 201 });
}

