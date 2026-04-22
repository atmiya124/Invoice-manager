import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { InvoiceForm } from "@/components/invoices/invoice-form";

type Params = { params: Promise<{ id: string }> };

export default async function EditInvoicePage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const { invoices: invoicesTable, clients: clientsTable } = await import("@/lib/schema");
  const { and, eq, asc } = await import("drizzle-orm");

  const [invoice, clients] = await Promise.all([
    db.query.invoices.findFirst({
      where: and(eq(invoicesTable.id, id), eq(invoicesTable.userId, session.user.id)),
    }),
    db.query.clients.findMany({
      where: and(eq(clientsTable.userId, session.user.id), eq(clientsTable.isArchived, false)),
      orderBy: asc(clientsTable.name),
    }),
  ]);

  if (!invoice) notFound();

  return (
    <div className="max-w-3xl">
      <p className="text-slate-500 text-sm mb-6">
        Edit invoice {invoice.invoiceNumber}. Status:{" "}
        <span className="font-medium">{invoice.status}</span>
      </p>
      <InvoiceForm
        clients={clients as any}
        defaultValues={{
          clientId: invoice.clientId,
          billingType: invoice.billingType,
          currency: invoice.currency,
          taxRate: invoice.taxRate ?? 0,
          hoursWorked: invoice.hoursWorked ?? undefined,
          hourlyRate: invoice.hourlyRate ?? undefined,
          fixedAmount: invoice.fixedAmount ?? undefined,
          taskSummary: invoice.taskSummary ?? undefined,
          notes: invoice.notes ?? undefined,
          privateNotes: invoice.privateNotes ?? undefined,
          paymentInstructions: invoice.paymentInstructions ?? undefined,
          billingPeriodStart: invoice.billingPeriodStart ?? null,
          billingPeriodEnd: invoice.billingPeriodEnd ?? null,
          dueDate: invoice.dueDate ?? undefined,
        }}
        invoiceId={invoice.id}
      />
    </div>
  );
}
