import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, invoices } from "@/lib/schema";
import { clientSchema } from "@/lib/validations";
import { NextRequest } from "next/server";
import { and, eq, desc, count } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.userId, session.user.id)),
    with: {
      invoices: {
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
      },
    },
  });

  if (!client) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(client);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.userId, session.user.id)),
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

  const [client] = await db
    .update(clients)
    .set({
      ...parsed.data,
      hourlyRate: parsed.data.hourlyRate ?? null,
      fixedRate: parsed.data.fixedRate ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(clients.id, id))
    .returning();

  return Response.json(client);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.userId, session.user.id)),
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

  const [client] = await db
    .update(clients)
    .set({ ...(body as Record<string, unknown>), updatedAt: new Date().toISOString() })
    .where(eq(clients.id, id))
    .returning();

  return Response.json(client);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.userId, session.user.id)),
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [{ n }] = await db
    .select({ n: count() })
    .from(invoices)
    .where(eq(invoices.clientId, id));

  if (n > 0) {
    return Response.json(
      { error: "Cannot delete a client with invoices. Archive them instead." },
      { status: 409 }
    );
  }

  await db.delete(clients).where(eq(clients.id, id));

  return new Response(null, { status: 204 });
}

