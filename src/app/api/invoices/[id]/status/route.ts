import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

const statusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE"]),
  paidAt: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.userId, session.user.id)),
  });
  if (!invoice) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const [updated] = await db
    .update(invoices)
    .set({
      status: parsed.data.status,
      paidAt:
        parsed.data.status === "PAID"
          ? parsed.data.paidAt
            ? new Date(parsed.data.paidAt).toISOString()
            : new Date().toISOString()
          : undefined,
      paymentMethod: parsed.data.paymentMethod ?? undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invoices.id, id))
    .returning();

  return Response.json(updated);
}

