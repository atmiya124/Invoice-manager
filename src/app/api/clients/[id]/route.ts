import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientSchema } from "@/lib/validations";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const client = await db.client.findFirst({
    where: { id, userId: session.user.id },
    include: {
      invoices: {
        include: { client: { select: { id: true, name: true, companyName: true, email: true, billingAddress: true, currency: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    ...client,
    hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
    fixedRate: client.fixedRate ? Number(client.fixedRate) : null,
    invoices: client.invoices.map((inv) => ({
      ...inv,
      total: Number(inv.total),
      subtotal: Number(inv.subtotal),
      taxAmount: Number(inv.taxAmount),
      taxRate: Number(inv.taxRate),
      hoursWorked: inv.hoursWorked ? Number(inv.hoursWorked) : null,
      hourlyRate: inv.hourlyRate ? Number(inv.hourlyRate) : null,
      fixedAmount: inv.fixedAmount ? Number(inv.fixedAmount) : null,
    })),
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.client.findFirst({
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

  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const client = await db.client.update({
    where: { id },
    data: {
      ...parsed.data,
      hourlyRate: parsed.data.hourlyRate ?? null,
      fixedRate: parsed.data.fixedRate ?? null,
    },
  });

  return Response.json(client);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.client.findFirst({
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

  const client = await db.client.update({
    where: { id },
    data: body as Record<string, unknown>,
  });

  return Response.json(client);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.client.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const invoiceCount = await db.invoice.count({ where: { clientId: id } });
  if (invoiceCount > 0) {
    return Response.json(
      { error: "Cannot delete a client with invoices. Archive them instead." },
      { status: 409 }
    );
  }

  await db.client.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
