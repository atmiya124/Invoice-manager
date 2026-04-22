import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, users } from "@/lib/schema";
import { invoiceSchema } from "@/lib/validations";
import { calculateInvoiceTotals, generateInvoiceNumber } from "@/lib/utils";
import { NextRequest } from "next/server";
import { and, eq, desc, count, like } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

const CLIENT_COLS = {
  id: true,
  name: true,
  companyName: true,
  email: true,
  billingAddress: true,
  currency: true,
} as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.userId, session.user.id)),
    with: {
      client: { columns: CLIENT_COLS },
      emailLogs: { orderBy: (el, { desc: d }) => [d(el.sentAt)] },
    },
  });

  if (!invoice) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(invoice);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.userId, session.user.id)),
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
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
  const totals = calculateInvoiceTotals({
    billingType: data.billingType,
    hoursWorked: data.hoursWorked ?? null,
    hourlyRate: data.hourlyRate ?? null,
    fixedAmount: data.fixedAmount ?? null,
    taxRate: data.taxRate ?? 0,
  });

  await db
    .update(invoices)
    .set({
      clientId: data.clientId,
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
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invoices.id, id));

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: { client: { columns: CLIENT_COLS } },
  });

  return Response.json(invoice);
}

// POST on existing invoice = duplicate it
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.userId, session.user.id)),
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

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

  const [duplicate] = await db
    .insert(invoices)
    .values({
      userId: session.user.id,
      clientId: existing.clientId,
      invoiceNumber,
      status: "DRAFT",
      billingType: existing.billingType,
      billingPeriodStart: existing.billingPeriodStart,
      billingPeriodEnd: existing.billingPeriodEnd,
      hoursWorked: existing.hoursWorked,
      hourlyRate: existing.hourlyRate,
      fixedAmount: existing.fixedAmount,
      subtotal: existing.subtotal,
      taxRate: existing.taxRate,
      taxAmount: existing.taxAmount,
      total: existing.total,
      currency: existing.currency,
      taskSummary: existing.taskSummary,
      notes: existing.notes,
      paymentInstructions: existing.paymentInstructions,
    })
    .returning();

  return Response.json(duplicate, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.userId, session.user.id)),
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(invoices).where(eq(invoices.id, id));

  return new Response(null, { status: 204 });
}
