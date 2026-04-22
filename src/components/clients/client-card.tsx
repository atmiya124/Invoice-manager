"use client";

import Link from "next/link";
import type { Client } from "@/types";
import { formatCurrency, getBillingCycleLabel, toDecimal } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Mail, Plus, FileText, Edit, Archive } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ClientCardProps {
  client: Client & {
    totalInvoices: number;
    isDue?: boolean;
  };
  onArchive?: (id: string) => void;
}

export function ClientCard({ client, onArchive }: ClientCardProps) {
  const [archiving, setArchiving] = useState(false);
  const router = useRouter();

  async function handleArchive() {
    if (!confirm("Archive this client? Their invoices will remain.")) return;
    setArchiving(true);
    try {
      await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      onArchive?.(client.id);
      router.refresh();
    } finally {
      setArchiving(false);
    }
  }

  const rate = toDecimal(client.hourlyRate) || toDecimal(client.fixedRate);
  const rateLabel = client.hourlyRate ? `/hr` : " flat";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">
              {client.name}
            </h3>
            {client.companyName && (
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {client.companyName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {client.isDue && (
              <Badge variant="warning">Due</Badge>
            )}
            <Badge variant="default">
              {getBillingCycleLabel(client.billingCycle)}
            </Badge>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-500 flex items-center gap-1 truncate">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          {client.email}
        </p>
      </div>

      {/* Stats */}
      <div className="border-t border-slate-100 grid grid-cols-2 divide-x divide-slate-100">
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-slate-400 mb-0.5">Invoices</p>
          <p className="text-sm font-semibold text-slate-700">
            {client.totalInvoices}
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-slate-400 mb-0.5">Rate</p>
          <p className="text-sm font-semibold text-slate-700">
            {rate ? `${formatCurrency(rate, client.currency)}${rateLabel}` : "—"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2">
        <Link
          href={`/invoices/new?clientId=${client.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Invoice
        </Link>
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          title="View invoices"
        >
          <FileText className="h-4 w-4" />
        </Link>
        <Link
          href={`/clients/${client.id}/edit`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          title="Edit client"
        >
          <Edit className="h-4 w-4" />
        </Link>
        <button
          onClick={handleArchive}
          disabled={archiving}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
          title="Archive client"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
