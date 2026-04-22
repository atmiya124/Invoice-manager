import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { InvoiceForm } from "@/components/invoices/invoice-form";

interface Props {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function NewInvoicePage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { clientId } = await searchParams;

  const { clients: clientsTable, users } = await import("@/lib/schema");
  const { and, eq, asc } = await import("drizzle-orm");

  const [clients, user] = await Promise.all([
    db.query.clients.findMany({
      where: and(eq(clientsTable.userId, session.user.id), eq(clientsTable.isArchived, false)),
      orderBy: asc(clientsTable.name),
    }),
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        name: true,
        businessName: true,
        businessEmail: true,
        businessAddress: true,
        hstNumber: true,
        defaultTaxRate: true,
        defaultCurrency: true,
        paymentInstructions: true,
      },
    }),
  ]);

  return (
    <div>
      <InvoiceForm
        clients={clients as any}
        defaultClientId={clientId}
        userDefaults={{
          defaultTaxRate: user?.defaultTaxRate ?? 0,
          defaultCurrency: user?.defaultCurrency ?? "CAD",
          paymentInstructions: user?.paymentInstructions ?? undefined,
          name: user?.name ?? undefined,
          businessName: user?.businessName ?? undefined,
          businessEmail: user?.businessEmail ?? undefined,
          businessAddress: user?.businessAddress ?? undefined,
          hstNumber: user?.hstNumber ?? undefined,
        }}
      />
    </div>
  );
}
