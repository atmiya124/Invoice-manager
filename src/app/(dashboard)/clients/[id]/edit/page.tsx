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

  const client = await db.client.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!client) notFound();

  const serializedClient = {
    ...client,
    hourlyRate: client.hourlyRate?.toNumber() ?? null,
    fixedRate: client.fixedRate?.toNumber() ?? null,
  };

  return (
    <div className="max-w-2xl">
      <p className="text-slate-500 text-sm mb-6">
        Update client details. Existing invoices will not be affected.
      </p>
      <ClientForm
        defaultValues={serializedClient}
        clientId={client.id}
      />
    </div>
  );
}
