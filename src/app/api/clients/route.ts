import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientSchema } from "@/lib/validations";
import { NextRequest } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await db.client.findMany({
    where: { userId: session.user.id },
    include: {
      invoices: {
        select: { status: true, total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = clients.map((client) => {
    const unpaidBalance = client.invoices
      .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const lastInvoice = client.invoices[0];

    return {
      ...client,
      hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
      fixedRate: client.fixedRate ? Number(client.fixedRate) : null,
      unpaidBalance,
      totalInvoices: client.invoices.length,
      lastInvoiceDate: lastInvoice?.createdAt ?? null,
      invoices: undefined,
    };
  });

  return Response.json(result);
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

  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const client = await db.client.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
      hourlyRate: parsed.data.hourlyRate ?? null,
      fixedRate: parsed.data.fixedRate ?? null,
    },
  });

  return Response.json(client, { status: 201 });
}
