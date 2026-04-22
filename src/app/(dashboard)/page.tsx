import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Send,
  AlertTriangle,
  Plus,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EarningsChart } from "@/components/dashboard/earnings-chart";

async function getDashboardData(userId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Auto-mark overdue
  await db.invoice.updateMany({
    where: { userId, status: "SENT", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });

  const [invoices, clients] = await Promise.all([
    db.invoice.findMany({
      where: { userId },
      include: {
        client: { select: { id: true, name: true, companyName: true, email: true, billingAddress: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.client.findMany({
      where: { userId, isArchived: false },
      include: { invoices: { select: { status: true, total: true, createdAt: true }, orderBy: { createdAt: "desc" } } },
    }),
  ]);

  const totalUnpaid = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((s, i) => s + Number(i.total), 0);

  const paidThisMonth = invoices
    .filter((i) => i.status === "PAID" && i.paidAt && new Date(i.paidAt) >= monthStart && new Date(i.paidAt) <= monthEnd)
    .reduce((s, i) => s + Number(i.total), 0);

  const sentThisMonth = invoices.filter(
    (i) => i.sentAt && new Date(i.sentAt) >= monthStart && new Date(i.sentAt) <= monthEnd
  ).length;

  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  // Monthly earnings (last 6 months)
  const monthlyEarnings = [];
  for (let idx = 5; idx >= 0; idx--) {
    const md = subMonths(now, idx);
    const mS = startOfMonth(md);
    const mE = endOfMonth(md);
    const paid = invoices.filter((i) => i.status === "PAID" && i.paidAt && new Date(i.paidAt) >= mS && new Date(i.paidAt) <= mE).reduce((s, i) => s + Number(i.total), 0);
    const pending = invoices.filter((i) => (i.status === "SENT" || i.status === "OVERDUE") && new Date(i.createdAt) >= mS && new Date(i.createdAt) <= mE).reduce((s, i) => s + Number(i.total), 0);
    monthlyEarnings.push({ month: format(md, "MMM"), paid, pending });
  }

  // Clients due
  const clientsDue = clients
    .map((c) => {
      const last = c.invoices[0];
      const daysSince = last ? Math.floor((now.getTime() - new Date(last.createdAt).getTime()) / 86400000) : 999;
      const cycleDays = c.billingCycle === "WEEKLY" ? 7 : c.billingCycle === "BIWEEKLY" ? 14 : 30;
      const isDue = !last || daysSince >= cycleDays;
      const unpaidBalance = c.invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.total), 0);
      return { ...c, isDue, unpaidBalance, totalInvoices: c.invoices.length, lastInvoiceDate: last?.createdAt ?? null, invoices: undefined };
    })
    .filter((c) => c.isDue);

  return {
    totalUnpaid,
    paidThisMonth,
    sentThisMonth,
    overdueCount,
    recentInvoices: invoices.slice(0, 6).map((i) => ({ ...i, total: Number(i.total), subtotal: Number(i.subtotal), taxAmount: Number(i.taxAmount), taxRate: Number(i.taxRate), hoursWorked: i.hoursWorked ? Number(i.hoursWorked) : null, hourlyRate: i.hourlyRate ? Number(i.hourlyRate) : null, fixedAmount: i.fixedAmount ? Number(i.fixedAmount) : null })),
    clientsDue,
    monthlyEarnings,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const data = await getDashboardData(session.user.id);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Welcome back{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}!
          </h2>
          <p className="text-slate-500 mt-0.5">
            Here&apos;s your invoicing overview for {format(new Date(), "MMMM yyyy")}.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Unpaid"
          value={formatCurrency(data.totalUnpaid)}
          icon={<DollarSign className="h-5 w-5" />}
          color="indigo"
          description="Outstanding balance"
        />
        <StatCard
          title="Paid This Month"
          value={formatCurrency(data.paidThisMonth)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="emerald"
          description={format(new Date(), "MMMM yyyy")}
        />
        <StatCard
          title="Invoices Sent"
          value={data.sentThisMonth.toString()}
          icon={<Send className="h-5 w-5" />}
          color="blue"
          description="This month"
        />
        <StatCard
          title="Overdue"
          value={data.overdueCount.toString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={data.overdueCount > 0 ? "red" : "slate"}
          description={data.overdueCount > 0 ? "Needs attention" : "All clear!"}
        />
      </div>

      {/* Chart + Clients Due */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Earnings Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <EarningsChart data={data.monthlyEarnings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clients Due</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.clientsDue.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">
                No clients due for invoicing
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.clientsDue.slice(0, 5).map((client) => (
                  <li key={client.id} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {client.companyName || client.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {client.billingCycle.toLowerCase()}
                      </p>
                    </div>
                    <Link
                      href={`/invoices/new?clientId=${client.id}`}
                      className="ml-2 shrink-0 inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Invoice
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <Link
            href="/invoices"
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentInvoices.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-slate-400 text-sm">No invoices yet.</p>
              <Link
                href="/invoices/new"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="h-4 w-4" />
                Create your first invoice
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3">
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-slate-700">
                        {inv.client.companyName || inv.client.name}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(inv.total, inv.currency)}
                      </td>
                      <td className="px-6 py-3 text-slate-500 text-xs">
                        {formatDate(inv.dueDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  description,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "blue" | "red" | "slate";
  description: string;
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-500",
  };

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className={`rounded-lg p-2 ${colors[color]}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
