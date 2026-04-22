import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailLogs, invoices } from "@/lib/schema";
import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: invoiceId } = await params;

  // Verify the invoice belongs to the current user
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.userId, session.user.id)),
    columns: { id: true },
  });
  if (!invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  let ids: string[];
  try {
    const body = await req.json();
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return Response.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }
    ids = body.ids;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only delete logs that belong to this invoice
  await db
    .delete(emailLogs)
    .where(and(inArray(emailLogs.id, ids), eq(emailLogs.invoiceId, invoiceId)));

  return Response.json({ success: true });
}
