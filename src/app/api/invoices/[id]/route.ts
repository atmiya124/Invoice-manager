import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceSchema } from "@/lib/validations";
import { calculateInvoiceTotals, generateInvoiceNumber } from "@/lib/utils";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

function serializeInvoice(invoice: Record<string, unknown>) {
  return {
    ...invoice,
    total: Number(invoice.total),
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    taxRate: Number(invoice.taxRate),
    hoursWorked: invoice.hoursWorked ? Number(invoice.hoursWorked) : null,
    hourlyRate: invoice.hourlyRate ? Number(invoice.hourlyRate) : null,
    fixedAmount: invoice.fixedAmount ? Number(invoice.fixedAmount) : null,
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await db.invoice.findFirst({
    where: { id, userId: session.user.id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          billingAddress: true,
          currency: true,
        },
      },
      emailLogs: { orderBy: { sentAt: "desc" } },
    },
  });

  if (!invoice) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(serializeInvoice(invoice as unknown as Record<string, unknown>));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.invoice.findFirst({
    where: { id, userId: session.user.id },
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

  const invoice = await db.invoice.update({
    where: { id },
    data: {
      clientId: data.clientId,
      billingType: data.billingType,
      billingPeriodStart: data.billingPeriodStart
        ? new Date(data.billingPeriodStart)
        : null,
      billingPeriodEnd: data.billingPeriodEnd
        ? new Date(data.billingPeriodEnd)
        : null,
      hoursWorked: data.hoursWorked ?? null,
      hourlyRate: data.hourlyRate ?? null,
      fixedAmount: data.fixedAmount ?? null,
      subtotal: totals.subtotal,
      taxRate: data.taxRate ?? 0,
      taxAmount: totals.taxAmount,
      total: totals.total,
      currency: data.currency,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      taskSummary: data.taskSummary ?? null,
      notes: data.notes ?? null,
      paymentInstructions: data.paymentInstructions ?? null,
      privateNotes: data.privateNotes ?? null,
    },
    include: {
      client: {
        select: {
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

  return Response.json(serializeInvoice(invoice as unknown as Record<string, unknown>));
}

// POST on existing invoice = duplicate it
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.invoice.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  const year = new Date().getFullYear();
  const existingCount = await db.invoice.count({
    where: {
      userId: session.user.id,
      invoiceNumber: { startsWith: `${user?.invoicePrefix ?? "INV"}-${year}-` },
    },
  });

  const invoiceNumber = generateInvoiceNumber(
    user?.invoicePrefix ?? "INV",
    year,
    existingCount + 1
  );

  const duplicate = await db.invoice.create({
    data: {
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
    },
  });

  return Response.json(serializeInvoice(duplicate as unknown as Record<string, unknown>), {
    status: 201,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.invoice.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db.invoice.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
