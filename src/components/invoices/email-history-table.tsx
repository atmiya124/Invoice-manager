"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface EmailLog {
  id: string;
  sentAt: string;
  recipientEmail: string;
  subject: string;
  status: string;
}

interface EmailHistoryTableProps {
  invoiceId: string;
  logs: EmailLog[];
}

export function EmailHistoryTable({ invoiceId, logs }: EmailHistoryTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const allSelected = selected.size === logs.length && logs.length > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(logs.map((l) => l.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const confirm = useConfirm();

  const deleteIds = useCallback(
    async (ids: string[]) => {
      if (!await confirm(
        ids.length === 1 ? "Delete this email log?" : `Delete ${ids.length} email logs?`,
        { title: "Delete Email Log", confirmLabel: "Delete", danger: true }
      )) return;
      setDeleting(true);
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/email-logs`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) throw new Error("Failed to delete");
        setSelected(new Set());
        router.refresh();
      } catch {
        toast.error("Failed to delete. Please try again.");
      } finally {
        setDeleting(false);
      }
    },
    [invoiceId, router, confirm]
  );

  if (logs.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Email History</p>
        {selected.size > 0 && (
          <button
            onClick={() => deleteIds([...selected])}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete {selected.size} selected
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sent</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">To</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
            <th className="w-10 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {logs.map((log) => (
            <tr
              key={log.id}
              className={`hover:bg-slate-50 transition-colors ${selected.has(log.id) ? "bg-indigo-50/50" : ""}`}
            >
              <td className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(log.id)}
                  onChange={() => toggleOne(log.id)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </td>
              <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(log.sentAt)}</td>
              <td className="px-4 py-3 text-slate-700">{log.recipientEmail}</td>
              <td className="px-4 py-3 text-slate-500 max-w-60 truncate">{log.subject}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                    log.status === "SENT"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-red-50 text-red-700 ring-red-200"
                  }`}
                >
                  {log.status}
                </span>
              </td>
              <td className="w-10 px-4 py-3">
                <button
                  onClick={() => deleteIds([log.id])}
                  disabled={deleting}
                  className="rounded-lg p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Delete log"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
