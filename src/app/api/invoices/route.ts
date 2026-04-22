import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceSchema } from "@/lib/validations";
import { calculateInvoiceTotals, generateInvoiceNumber } from "@/lib/utils";
import { NextRequest } from "next/server";
import { InvoiceStatus, Prisma } from "@/generated/prisma/client";
import { isAfter } from "date-fns";

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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as InvoiceStatus | null;
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");

  const where: Prisma.InvoiceWhereInput = {
    userId: session.user.id,
    ...(status && { status }),
    ...(clientId && { clientId }),
    ...(search && {
      OR: [
        { invoiceNumber: { contains: search } },
        { client: { name: { contains: search } } },
        { client: { companyName: { contains: search } } },
      ],
    }),
  };

  const invoices = await db.invoice.findMany({
    where,
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
    orderBy: { createdAt: "desc" },
  });

  // Auto-mark overdue
  const now = new Date();
  const toMarkOverdue = invoices
    .filter(
      (inv) =>
        inv.status === "SENT" &&
        inv.dueDate &&
        isAfter(now, new Date(inv.dueDate))
    )
    .map((inv) => inv.id);

  if (toMarkOverdue.length > 0) {
    await db.invoice.updateMany({
      where: { id: { in: toMarkOverdue } },
      data: { status: "OVERDUE" },
    });
    // Update in-memory
    for (const inv of invoices) {
      if (toMarkOverdue.includes(inv.id)) {
        inv.status = "OVERDUE";
      }
    }
  }

  return Response.json(invoices.map(serializeInvoice));
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
  const client = await db.client.findFirst({
    where: { id: data.clientId, userId: session.user.id },
  });
  if (!client) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  // Generate invoice number
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

  // Calculate totals
  const totals = calculateInvoiceTotals({
    billingType: data.billingType,
    hoursWorked: data.hoursWorked ?? null,
    hourlyRate: data.hourlyRate ?? null,
    fixedAmount: data.fixedAmount ?? null,
    taxRate: data.taxRate ?? 0,
  });

  const invoice = await db.invoice.create({
    data: {
      userId: session.user.id,
      clientId: data.clientId,
      invoiceNumber,
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

  return Response.json(serializeInvoice(invoice as unknown as Record<string, unknown>), {
    status: 201,
  });
}
