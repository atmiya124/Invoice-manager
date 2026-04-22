import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, Archive } from "lucide-react";
import { ClientCard } from "@/components/clients/client-card";

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { clients: clientsTable, invoices } = await import("@/lib/schema");
  const { eq, desc } = await import("drizzle-orm");

  const clients = await db.query.clients.findMany({
    where: eq(clientsTable.userId, session.user.id),
    with: {
      invoices: {
        columns: { status: true, total: true, createdAt: true },
        orderBy: desc(invoices.createdAt),
      },
    },
    orderBy: desc(clientsTable.createdAt),
  });

  const activeClients = clients
    .filter((c) => !c.isArchived)
    .map((client) => {
      const last = client.invoices[0];
      const daysSince = last
        ? Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 86400000)
        : 999;
      const cycleDays =
        client.billingCycle === "WEEKLY" ? 7 : client.billingCycle === "BIWEEKLY" ? 14 : 30;
      const isDue = client.billingCycle !== "CUSTOM" && (!last || daysSince >= cycleDays);

      return {
        ...client,
        totalInvoices: client.invoices.length,
        isDue,
        invoices: undefined,
      };
    });

  const archivedClients = clients.filter((c) => c.isArchived);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm">
            {activeClients.length} active client{activeClients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      {/* Active clients grid */}
      {activeClients.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Plus className="h-6 w-6 text-slate-400" />
          </div>
          <p className="font-medium text-slate-700">No clients yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Add your first client to start invoicing
          </p>
          <Link
            href="/clients/new"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeClients.map((client) => (
            <ClientCard key={client.id} client={client as Parameters<typeof ClientCard>[0]["client"]} />
          ))}
        </div>
      )}

      {/* Archived clients */}
      {archivedClients.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors select-none">
            <Archive className="h-4 w-4" />
            {archivedClients.length} archived client{archivedClients.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
            {archivedClients.map((client) => (
              <div
                key={client.id}
                className="rounded-xl border border-slate-200 bg-white px-5 py-4"
              >
                <p className="font-medium text-slate-600">{client.name}</p>
                {client.companyName && (
                  <p className="text-sm text-slate-400">{client.companyName}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/clients/${client.id}/edit`}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
