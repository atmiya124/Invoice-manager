import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf";
import { NextRequest } from "next/server";
import React from "react";

type Params = { params: Promise<{ id: string }> };

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
          name: true,
          companyName: true,
          email: true,
          billingAddress: true,
        },
      },
      user: {
        select: {
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

  const invoiceData = {
    ...invoice,
    total: Number(invoice.total),
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    taxRate: Number(invoice.taxRate),
    hoursWorked: invoice.hoursWorked ? Number(invoice.hoursWorked) : null,
    hourlyRate: invoice.hourlyRate ? Number(invoice.hourlyRate) : null,
    fixedAmount: invoice.fixedAmount ? Number(invoice.fixedAmount) : null,
  };

  const buffer = await renderToBuffer(
    React.createElement(InvoicePDF, { invoice: invoiceData, user: invoice.user }) as any
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
