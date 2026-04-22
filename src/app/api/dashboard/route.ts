import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, clients } from "@/lib/schema";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { and, eq, desc, lt } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Auto-mark overdue
  await db
    .update(invoices)
    .set({ status: "OVERDUE" })
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.status, "SENT"),
        lt(invoices.dueDate, now.toISOString())
      )
    );

  const [invoiceList, clientList] = await Promise.all([
    db.query.invoices.findMany({
      where: eq(invoices.userId, userId),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            companyName: true,
            email: true,
            billingAddress: true,
            currency: true,
          },
        },
      },
      orderBy: desc(invoices.createdAt),
    }),
    db.query.clients.findMany({
      where: and(eq(clients.userId, userId), eq(clients.isArchived, false)),
      with: {
        invoices: {
          columns: { status: true, total: true, createdAt: true },
          orderBy: desc(invoices.createdAt),
        },
      },
    }),
  ]);

  // Stats
  const totalUnpaid = invoiceList
    .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + inv.total, 0);

  const paidThisMonth = invoiceList
    .filter(
      (inv) =>
        inv.status === "PAID" &&
        inv.paidAt &&
        new Date(inv.paidAt) >= monthStart &&
        new Date(inv.paidAt) <= monthEnd
    )
    .reduce((sum, inv) => sum + inv.total, 0);

  const sentThisMonth = invoiceList.filter(
    (inv) =>
      inv.sentAt &&
      new Date(inv.sentAt) >= monthStart &&
      new Date(inv.sentAt) <= monthEnd
  ).length;

  const overdueInvoices = invoiceList.filter((inv) => inv.status === "OVERDUE");
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);

  // Monthly earnings (last 6 months)
  const monthlyEarnings: { month: string; paid: number; pending: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const monthLabel = format(monthDate, "MMM");

    const paid = invoiceList
      .filter(
        (inv) =>
          inv.status === "PAID" &&
          inv.paidAt &&
          new Date(inv.paidAt) >= mStart &&
          new Date(inv.paidAt) <= mEnd
      )
      .reduce((sum, inv) => sum + inv.total, 0);

    const pending = invoiceList
      .filter(
        (inv) =>
          (inv.status === "SENT" || inv.status === "OVERDUE") &&
          new Date(inv.createdAt) >= mStart &&
          new Date(inv.createdAt) <= mEnd
      )
      .reduce((sum, inv) => sum + inv.total, 0);

    monthlyEarnings.push({ month: monthLabel, paid, pending });
  }

  // Earnings by client
  const clientEarnings = new Map<string, { name: string; total: number }>();
  for (const inv of invoiceList.filter((i) => i.status === "PAID")) {
    const clientName = inv.client.companyName || inv.client.name;
    const existing = clientEarnings.get(inv.clientId);
    if (existing) {
      existing.total += inv.total;
    } else {
      clientEarnings.set(inv.clientId, { name: clientName, total: inv.total });
    }
  }

  const earningsByClient = Array.from(clientEarnings.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Clients due for invoicing
  const clientsDue = clientList
    .map((client) => {
      const lastInvoice = client.invoices[0];
      const unpaidBalance = client.invoices
        .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
        .reduce((sum, inv) => sum + inv.total, 0);

      let isDue = false;
      if (client.billingCycle !== "CUSTOM" && lastInvoice) {
        const lastDate = new Date(lastInvoice.createdAt);
        const daysSinceLast = Math.floor(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const cycleDays =
          client.billingCycle === "WEEKLY" ? 7 : client.billingCycle === "BIWEEKLY" ? 14 : 30;
        isDue = daysSinceLast >= cycleDays;
      } else if (!lastInvoice) {
        isDue = true;
      }

      return {
        ...client,
        unpaidBalance,
        totalInvoices: client.invoices.length,
        lastInvoiceDate: lastInvoice?.createdAt ?? null,
        isDue,
        invoices: undefined,
      };
    })
    .filter((c) => c.isDue);

  return Response.json({
    totalUnpaid,
    paidThisMonth,
    sentThisMonth,
    overdueCount: overdueInvoices.length,
    overdueAmount,
    recentInvoices: invoiceList.slice(0, 8),
    clientsDue,
    monthlyEarnings,
    earningsByClient,
  });
}


