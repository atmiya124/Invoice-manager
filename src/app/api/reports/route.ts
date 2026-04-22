import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  const invoiceList = await db.query.invoices.findMany({
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
  });

  // Monthly income (paid, last 12 months)
  const monthlyIncome: { month: string; amount: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);

    const amount = invoiceList
      .filter(
        (inv) =>
          inv.status === "PAID" &&
          inv.paidAt &&
          new Date(inv.paidAt) >= mStart &&
          new Date(inv.paidAt) <= mEnd
      )
      .reduce((sum, inv) => sum + inv.total, 0);

    monthlyIncome.push({ month: format(monthDate, "MMM yyyy"), amount });
  }

  // Income by client (all time, paid)
  const clientMap = new Map<
    string,
    { clientName: string; companyName: string | null; amount: number }
  >();
  for (const inv of invoiceList.filter((i) => i.status === "PAID")) {
    const key = inv.clientId;
    const existing = clientMap.get(key);
    if (existing) {
      existing.amount += inv.total;
    } else {
      clientMap.set(key, {
        clientName: inv.client.name,
        companyName: inv.client.companyName,
        amount: inv.total,
      });
    }
  }
  const clientIncome = Array.from(clientMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  // Summary
  const summary = {
    totalPaid: invoiceList.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0),
    totalUnpaid: invoiceList.filter((i) => i.status === "SENT").reduce((s, i) => s + i.total, 0),
    totalOverdue: invoiceList.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + i.total, 0),
    totalDraft: invoiceList.filter((i) => i.status === "DRAFT").reduce((s, i) => s + i.total, 0),
  };

  // Unpaid invoices
  const unpaidInvoices = invoiceList.filter(
    (i) => i.status === "SENT" || i.status === "OVERDUE"
  );

  return Response.json({ monthlyIncome, clientIncome, unpaidInvoices, summary });
}
