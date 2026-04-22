import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import {
  Edit,
  Plus,
  Mail,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
} from "lucide-react";
import { formatCurrency, getBillingCycleLabel, toDecimal } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { InvoiceWithClient } from "@/types";

type Params = { params: Promise<{ id: string }> };

export default async function ClientDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const client = await db.client.findFirst({
    where: { id, userId: session.user.id },
    include: {
      invoices: {
        include: {
          client: { select: { id: true, name: true, companyName: true, email: true, billingAddress: true, currency: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  const invoices: InvoiceWithClient[] = client.invoices.map((inv) => ({
    ...inv,
    total: Number(inv.total),
    subtotal: Number(inv.subtotal),
    taxAmount: Number(inv.taxAmount),
    taxRate: Number(inv.taxRate),
    hoursWorked: inv.hoursWorked ? Number(inv.hoursWorked) : null,
    hourlyRate: inv.hourlyRate ? Number(inv.hourlyRate) : null,
    fixedAmount: inv.fixedAmount ? Number(inv.fixedAmount) : null,
  }));

  const totalInvoices = invoices.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {client.companyName || client.name}
          </h2>
          {client.companyName && (
            <p className="text-slate-500 mt-0.5">Contact: {client.name}</p>
          )}
          {client.isArchived && (
            <Badge variant="warning" className="mt-1">
              Archived
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/invoices/new?clientId=${client.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
          <Link
            href={`/clients/${client.id}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Client info + stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Client Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <a
                href={`mailto:${client.email}`}
                className="text-indigo-600 hover:underline"
              >
                {client.email}
              </a>
            </div>
            {client.billingAddress && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-slate-700">{client.billingAddress}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-slate-700">
                {getBillingCycleLabel(client.billingCycle)} billing
              </span>
            </div>
            {(client.hourlyRate || client.fixedRate) && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-slate-700">
                  {client.hourlyRate
                    ? `${formatCurrency(toDecimal(client.hourlyRate), client.currency)}/hr`
                    : `${formatCurrency(toDecimal(client.fixedRate), client.currency)} flat`}
                </span>
              </div>
            )}
            <div className="text-sm text-slate-500">
              Payment: {client.paymentTerms}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <div className="text-center rounded-xl bg-slate-50 py-4">
                <p className="text-2xl font-bold text-slate-900">
                  {totalInvoices}
                </p>
                <p className="text-xs text-slate-500 mt-1">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <Link
            href={`/invoices/new?clientId=${client.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <InvoiceTable invoices={invoices} showClient={false} />
        </CardContent>
      </Card>
    </div>
  );
}
