import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, emailLogs } from "@/lib/schema";
import { sendEmailSchema } from "@/lib/validations";
import { sendInvoiceEmail } from "@/lib/gmail";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf";
import { interpolateEmailTemplate } from "@/lib/utils";
import { NextRequest } from "next/server";
import React from "react";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
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

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, { invoice, user: invoice.user }) as any
    );
  } catch (err) {
    console.error("PDF generation failed:", err);
    return Response.json({ error: "PDF generation failed" }, { status: 500 });
  }

  const senderName = invoice.user.businessName || invoice.user.name || "Freelancer";

  // Send via Gmail API
  try {
    await sendInvoiceEmail({
      userId: session.user.id,
      to: invoice.client.email,
      cc: parsed.data.ccEmails,
      subject: parsed.data.subject,
      body: parsed.data.body,
      pdfBuffer,
      pdfFilename: `${invoice.invoiceNumber}.pdf`,
      fromName: senderName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";

    await db.insert(emailLogs).values({
      invoiceId: id,
      recipientEmail: invoice.client.email,
      subject: parsed.data.subject,
      status: "FAILED",
      errorMessage: message,
    });

    return Response.json({ error: message }, { status: 500 });
  }

  // Log success + update invoice
  await Promise.all([
    db.insert(emailLogs).values({
      invoiceId: id,
      recipientEmail: invoice.client.email,
      subject: parsed.data.subject,
      status: "SENT",
    }),
    db
      .update(invoices)
      .set({
        status: "SENT",
        sentAt: new Date().toISOString(),
        emailSubject: parsed.data.subject,
        emailBody: parsed.data.body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, id)),
  ]);

  return Response.json({ success: true });
}

