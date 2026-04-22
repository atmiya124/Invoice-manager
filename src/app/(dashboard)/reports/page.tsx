import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EarningsChart } from "@/components/dashboard/earnings-chart";
import Link from "next/link";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const now = new Date();

  // Build 12-month windows
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = startOfMonth(subMonths(now, 11 - i));
    const end = endOfMonth(subMonths(now, 11 - i));
    return { label: format(start, "MMM yy"), start, end };
  });

  const invoices = await db.invoice.findMany({
    where: { userId, createdAt: { gte: months[0].start } },
    include: {
      client: { select: { id: true, name: true, companyName: true } },
    },
  });

  // Monthly income
  const monthlyData = months.map(({ label, start, end }) => {
    const slice = invoices.filter(
      (i) => i.createdAt >= start && i.createdAt <= end
    );
    const paid = slice
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + Number(i.total), 0);
    const pending = slice
      .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
      .reduce((s, i) => s + Number(i.total), 0);
    return { month: label, paid, pending };
  });

  // Per-client income (paid only)
  const clientMap = new Map<string, { name: string; total: number; count: number }>();
  invoices
    .filter((i) => i.status === "PAID")
    .forEach((i) => {
      const name = i.client.companyName || i.client.name;
      const prev = clientMap.get(i.clientId) ?? { name, total: 0, count: 0 };
      clientMap.set(i.clientId, {
        name,
        total: prev.total + Number(i.total),
        count: prev.count + 1,
      });
    });
  const clientIncome = Array.from(clientMap.values()).sort(
    (a, b) => b.total - a.total
  );

  const totalPaid = invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + Number(i.total), 0);
  const totalPending = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((s, i) => s + Number(i.total), 0);
  const unpaidInvoices = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .sort((a, b) => Number(b.total) - Number(a.total));

  const defaultCurrency =
    (
      await db.user.findUnique({
        where: { id: userId },
        select: { defaultCurrency: true },
      })
    )?.defaultCurrency ?? "USD";

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Total Paid (12mo)
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatCurrency(totalPaid, defaultCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Pending
            </p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {formatCurrency(totalPending, defaultCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Total Invoices
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {invoices.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Earnings (12 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <EarningsChart data={monthlyData} />
        </CardContent>
      </Card>

      {/* Client income + unpaid side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income by Client</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clientIncome.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400">
                No paid invoices yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Client
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Paid
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Inv
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {clientIncome.map((c) => (
                    <tr key={c.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {c.name}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-emerald-700">
                        {formatCurrency(c.total, defaultCurrency)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-500">
                        {c.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unpaid Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {unpaidInvoices.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400">
                No outstanding invoices.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {unpaidInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {inv.client.companyName || inv.client.name} ·{" "}
                          {formatDate(inv.createdAt)}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(Number(inv.total), defaultCurrency)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
