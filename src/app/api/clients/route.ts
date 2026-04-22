import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, invoices } from "@/lib/schema";
import { clientSchema } from "@/lib/validations";
import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientList = await db.query.clients.findMany({
    where: eq(clients.userId, session.user.id),
    with: {
      invoices: {
        columns: { status: true, total: true, createdAt: true },
        orderBy: desc(invoices.createdAt),
      },
    },
    orderBy: desc(clients.createdAt),
  });

  const result = clientList.map((client) => {
    const unpaidBalance = client.invoices
      .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    const lastInvoice = client.invoices[0];

    return {
      ...client,
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

  const [client] = await db
    .insert(clients)
    .values({
      ...parsed.data,
      userId: session.user.id,
      hourlyRate: parsed.data.hourlyRate ?? null,
      fixedRate: parsed.data.fixedRate ?? null,
    })
    .returning();

  return Response.json(client, { status: 201 });
}

