"use client";

import { useState, useCallback, Suspense, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { Input } from "@/components/ui/input";
import { InvoiceWithClient } from "@/types";
import { Search, Plus, Trash2, CalendarDays, X } from "lucide-react";
import Link from "next/link";

import { useConfirm } from "@/components/ui/confirm-dialog";

type PeriodKey = "" | "this-month" | "last-month" | "last-3" | "last-6" | "this-year";

const PERIOD_LABELS: { label: string; value: PeriodKey }[] = [
  { label: "All time", value: "" },
  { label: "This month", value: "this-month" },
  { label: "Last month", value: "last-month" },
  { label: "Last 3 mo", value: "last-3" },
  { label: "Last 6 mo", value: "last-6" },
  { label: "This year", value: "this-year" },
];

function getPeriodRange(key: PeriodKey): { from: Date; to: Date } | null {
  const now = new Date();
  if (key === "this-month")
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  if (key === "last-month")
    return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
  if (key === "last-3")
    return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  if (key === "last-6")
    return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  if (key === "this-year")
    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
  return null;
}

function MiniCalendar({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => {
    if (value) return new Date(value + "T00:00:00");
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selected = value ? new Date(value + "T00:00:00") : null;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function isoDate(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function isSelected(day: number) {
    return selected?.getFullYear() === year && selected?.getMonth() === month && selected?.getDate() === day;
  }

  function isInRange(day: number) {
    if (!selected) return false;
    const d = new Date(year, month, day);
    const to = new Date(selected);
    to.setDate(to.getDate() + 29);
    return d > selected && d <= to;
  }

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-lg p-1 hover:bg-slate-100 text-slate-500">‹</button>
        <span className="text-sm font-semibold text-slate-800">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-lg p-1 hover:bg-slate-100 text-slate-500">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const sel = isSelected(day);
          const inRange = isInRange(day);
          return (
            <button
              key={i}
              onClick={() => { onChange(isoDate(day)); onClose(); }}
              className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${
                sel ? "bg-indigo-600 text-white" : inRange ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between items-center">
        <button onClick={() => { onChange(""); onClose(); }} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
        <button
          onClick={() => { onChange(today.toISOString().split("T")[0]); onClose(); }}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Today
        </button>
      </div>
    </div>
  );
}

function InvoicesContent() {
  const searchParams = useSearchParams();

  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [period, setPeriod] = useState<PeriodKey>("");
  const [dateFrom, setDateFrom] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const confirm = useConfirm();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    try {
      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (res.ok) setInvoices(await res.json());
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(fetchInvoices, 300);
    return () => clearTimeout(t);
  }, [fetchInvoices]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") fetchInvoices();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchInvoices]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false);
    }
    if (calOpen) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [calOpen]);

  function selectDate(v: string) {
    setDateFrom(v);
    if (v) setPeriod("");
    setSelected(new Set());
  }
  function selectPeriod(v: PeriodKey) {
    setPeriod(v);
    if (v) setDateFrom("");
    setSelected(new Set());
  }

  const filtered = useMemo(() => {
    let list = invoices;
    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      const to = new Date(from);
      to.setDate(to.getDate() + 29);
      to.setHours(23, 59, 59);
      list = list.filter((inv) => {
        const ref = inv.billingPeriodStart ?? inv.createdAt;
        if (!ref) return false;
        const d = new Date(ref);
        return d >= from && d <= to;
      });
    } else {
      const range = getPeriodRange(period);
      if (range) {
        list = list.filter((inv) => {
          const ref = inv.billingPeriodStart ?? inv.createdAt;
          if (!ref) return false;
          const d = new Date(ref);
          return d >= range.from && d <= range.to;
        });
      }
    }
    return list;
  }, [invoices, period, dateFrom]);

  const counts = {
    all: filtered.length,
    draft: filtered.filter((i) => i.status === "DRAFT").length,
    sent: filtered.filter((i) => i.status === "SENT").length,
    paid: filtered.filter((i) => i.status === "PAID").length,
    overdue: filtered.filter((i) => i.status === "OVERDUE").length,
  };

  const visibleIds = new Set(filtered.map((i) => i.id));
  const cleanSelected = new Set([...selected].filter((id) => visibleIds.has(id)));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (cleanSelected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  }

  async function bulkDelete() {
    if (!await confirm(`Delete ${cleanSelected.size} invoice${cleanSelected.size > 1 ? "s" : ""}? This cannot be undone.`, { title: "Delete Invoices", confirmLabel: "Delete", danger: true })) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...cleanSelected].map((id) => fetch(`/api/invoices/${id}`, { method: "DELETE" })));
      setSelected(new Set());
      fetchInvoices();
    } finally {
      setBulkDeleting(false);
    }
  }

  const calLabel = dateFrom
    ? (() => {
        const from = new Date(dateFrom + "T00:00:00");
        const to = new Date(from);
        to.setDate(to.getDate() + 29);
        return `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      })()
    : null;

  return (
    <div className="space-y-4">
      {/* Row 1: Status tabs + New button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { label: "All", value: "", count: counts.all },
            { label: "Draft", value: "DRAFT", count: counts.draft },
            { label: "Sent", value: "SENT", count: counts.sent },
            { label: "Paid", value: "PAID", count: counts.paid },
            { label: "Overdue", value: "OVERDUE", count: counts.overdue },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatus(tab.value); setSelected(new Set()); }}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.value ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${status === tab.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <Link
          href="/invoices/new"
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </Link>
      </div>

      {/* Row 2: Search (left) + period pills + calendar (right) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left */}
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); }}
              placeholder="Search invoices or clients…"
              className="pl-9"
            />
          </div>
          {cleanSelected.size > 0 && (
            <button
              onClick={bulkDelete}
              disabled={bulkDeleting}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete {cleanSelected.size}
            </button>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {!dateFrom && PERIOD_LABELS.map((p) => (
            <button
              key={p.value}
              onClick={() => selectPeriod(p.value)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                period === p.value ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}

          {calLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700">
              <CalendarDays className="h-3.5 w-3.5" />
              {calLabel}
              <button onClick={() => selectDate("")} className="ml-0.5 rounded-full hover:bg-indigo-100 p-0.5">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          <div ref={calRef} className="relative">
            <button
              onClick={() => setCalOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                calOpen || dateFrom ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              title="Pick a start date (shows 30 days)"
            >
              <CalendarDays className="h-4 w-4" />
              {!calLabel && "Date"}
            </button>
            {calOpen && (
              <MiniCalendar value={dateFrom} onChange={selectDate} onClose={() => setCalOpen(false)} />
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <InvoiceTable
            invoices={filtered}
            selected={cleanSelected}
            onSelectChange={toggleOne}
            onSelectAll={toggleAll}
            onDeleted={fetchInvoices}
            onStatusChanged={fetchInvoices}
          />
        )}
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-slate-400">Loading…</div>}>
      <InvoicesContent />
    </Suspense>
  );
}
