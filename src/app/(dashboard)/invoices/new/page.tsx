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

  const [clients, user] = await Promise.all([
    db.client.findMany({
      where: { userId: session.user.id, isArchived: false },
      orderBy: { name: "asc" },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
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

  const serializedClients = clients.map((c) => ({
    ...c,
    hourlyRate: c.hourlyRate ? Number(c.hourlyRate) : null,
    fixedRate: c.fixedRate ? Number(c.fixedRate) : null,
  }));

  return (
    <div>
      <InvoiceForm
        clients={serializedClients as any}
        defaultClientId={clientId}
        userDefaults={{
          defaultTaxRate: Number(user?.defaultTaxRate ?? 0),
          defaultCurrency: user?.defaultCurrency ?? "USD",
          paymentInstructions: user?.paymentInstructions,
          name: user?.name,
          businessName: user?.businessName,
          businessEmail: user?.businessEmail,
          businessAddress: user?.businessAddress,
          hstNumber: user?.hstNumber,
        }}
      />
    </div>
  );
}
