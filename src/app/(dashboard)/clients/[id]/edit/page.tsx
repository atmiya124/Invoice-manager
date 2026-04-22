import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ClientForm } from "@/components/clients/client-form";

type Params = { params: Promise<{ id: string }> };

export default async function EditClientPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const { clients: clientsTable } = await import("@/lib/schema");
  const { and, eq } = await import("drizzle-orm");

  const client = await db.query.clients.findFirst({
    where: and(eq(clientsTable.id, id), eq(clientsTable.userId, session.user.id)),
  });

  if (!client) notFound();

  return (
    <div className="max-w-2xl">
      <p className="text-slate-500 text-sm mb-6">
        Update client details. Existing invoices will not be affected.
      </p>
      <ClientForm
        defaultValues={client}
        clientId={client.id}
      />
    </div>
  );
}
