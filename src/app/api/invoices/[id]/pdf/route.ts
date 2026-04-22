import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf";
import { NextRequest } from "next/server";
import React from "react";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.userId, session.user.id)),
    with: {
      client: {
        columns: {
          name: true,
          companyName: true,
          email: true,
          billingAddress: true,
        },
      },
      user: {
        columns: {
          name: true,
          businessName: true,
          businessEmail: true,
          businessAddress: true,
          businessPhone: true,
          hstNumber: true,
          paymentInstructions: true,
        },
      },
    },
  });

  if (!invoice) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    React.createElement(InvoicePDF, { invoice, user: invoice.user }) as any
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

