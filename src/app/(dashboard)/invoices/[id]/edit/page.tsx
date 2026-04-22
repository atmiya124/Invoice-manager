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

  const [invoice, clients] = await Promise.all([
    db.invoice.findFirst({
      where: { id, userId: session.user.id },
    }),
    db.client.findMany({
      where: { userId: session.user.id, isArchived: false },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!invoice) notFound();

  const serializedClients = clients.map((c) => ({
    ...c,
    hourlyRate: c.hourlyRate ? Number(c.hourlyRate) : null,
    fixedRate: c.fixedRate ? Number(c.fixedRate) : null,
  }));

  return (
    <div className="max-w-3xl">
      <p className="text-slate-500 text-sm mb-6">
        Edit invoice {invoice.invoiceNumber}. Status:{" "}
        <span className="font-medium">{invoice.status}</span>
      </p>
      <InvoiceForm
        clients={serializedClients as any}
        defaultValues={{
          clientId: invoice.clientId,
          billingType: invoice.billingType,
          currency: invoice.currency,
          taxRate: Number(invoice.taxRate),
          hoursWorked: invoice.hoursWorked ? Number(invoice.hoursWorked) : undefined,
          hourlyRate: invoice.hourlyRate ? Number(invoice.hourlyRate) : undefined,
          fixedAmount: invoice.fixedAmount ? Number(invoice.fixedAmount) : undefined,
          taskSummary: invoice.taskSummary ?? undefined,
          notes: invoice.notes ?? undefined,
          privateNotes: invoice.privateNotes ?? undefined,
          paymentInstructions: invoice.paymentInstructions ?? undefined,
          billingPeriodStart: invoice.billingPeriodStart?.toISOString() ?? null,
          billingPeriodEnd: invoice.billingPeriodEnd?.toISOString() ?? null,
          dueDate: invoice.dueDate?.toISOString() ?? undefined,
        }}
        invoiceId={invoice.id}
      />
    </div>
  );
}
