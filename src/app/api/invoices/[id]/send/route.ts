import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmailSchema } from "@/lib/validations";
import { sendInvoiceEmail } from "@/lib/gmail";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf";
import { interpolateEmailTemplate } from "@/lib/utils";
import { NextRequest } from "next/server";
import React from "react";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
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
          paymentInstructions: true,
        },
      },
    },
  });

  if (!invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sendEmailSchema.safeParse({ ...(body as object), invoiceId: id });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
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

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, { invoice: invoiceData, user: invoice.user }) as any
    );
  } catch (err) {
    console.error("PDF generation failed:", err);
    return Response.json({ error: "PDF generation failed" }, { status: 500 });
  }

  const senderName =
    invoice.user.businessName || invoice.user.name || "Freelancer";

  // Send via Gmail API
  try {
    await sendInvoiceEmail({
      userId: session.user.id,
      to: invoice.client.email,
      subject: parsed.data.subject,
      body: parsed.data.body,
      pdfBuffer,
      pdfFilename: `${invoice.invoiceNumber}.pdf`,
      fromName: senderName,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send email";

    // Log failed attempt
    await db.emailLog.create({
      data: {
        invoiceId: id,
        recipientEmail: invoice.client.email,
        subject: parsed.data.subject,
        status: "FAILED",
        errorMessage: message,
      },
    });

    return Response.json({ error: message }, { status: 500 });
  }

  // Log success + update invoice
  await Promise.all([
    db.emailLog.create({
      data: {
        invoiceId: id,
        recipientEmail: invoice.client.email,
        subject: parsed.data.subject,
        status: "SENT",
      },
    }),
    db.invoice.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        emailSubject: parsed.data.subject,
        emailBody: parsed.data.body,
      },
    }),
  ]);

  return Response.json({ success: true });
}
