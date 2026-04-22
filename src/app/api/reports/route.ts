import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  const invoices = await db.invoice.findMany({
    where: { userId },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          billingAddress: true,
          currency: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Monthly income (paid, last 12 months)
  const monthlyIncome: { month: string; amount: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);

    const amount = invoices
      .filter(
        (inv) =>
          inv.status === "PAID" &&
          inv.paidAt &&
          new Date(inv.paidAt) >= mStart &&
          new Date(inv.paidAt) <= mEnd
      )
      .reduce((sum, inv) => sum + Number(inv.total), 0);

    monthlyIncome.push({ month: format(monthDate, "MMM yyyy"), amount });
  }

  // Income by client (all time, paid)
  const clientMap = new Map<
    string,
    { clientName: string; companyName: string | null; amount: number }
  >();
  for (const inv of invoices.filter((i) => i.status === "PAID")) {
    const key = inv.clientId;
    const existing = clientMap.get(key);
    if (existing) {
      existing.amount += Number(inv.total);
    } else {
      clientMap.set(key, {
        clientName: inv.client.name,
        companyName: inv.client.companyName,
        amount: Number(inv.total),
      });
    }
  }
  const clientIncome = Array.from(clientMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  // Summary
  const summary = {
    totalPaid: invoices
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + Number(i.total), 0),
    totalUnpaid: invoices
      .filter((i) => i.status === "SENT")
      .reduce((s, i) => s + Number(i.total), 0),
    totalOverdue: invoices
      .filter((i) => i.status === "OVERDUE")
      .reduce((s, i) => s + Number(i.total), 0),
    totalDraft: invoices
      .filter((i) => i.status === "DRAFT")
      .reduce((s, i) => s + Number(i.total), 0),
  };

  // Unpaid invoices
  const unpaidInvoices = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .map((inv) => ({
      ...inv,
      total: Number(inv.total),
      subtotal: Number(inv.subtotal),
      taxAmount: Number(inv.taxAmount),
      taxRate: Number(inv.taxRate),
      hoursWorked: inv.hoursWorked ? Number(inv.hoursWorked) : null,
      hourlyRate: inv.hourlyRate ? Number(inv.hourlyRate) : null,
      fixedAmount: inv.fixedAmount ? Number(inv.fixedAmount) : null,
    }));

  return Response.json({ monthlyIncome, clientIncome, unpaidInvoices, summary });
}
