"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface EarningsChartProps {
  data: { month: string; paid: number; pending: number }[];
  currency?: string;
}

export function EarningsChart({ data, currency = "USD" }: EarningsChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        No earnings data yet
      </div>
    );
  }

  if (!mounted) {
    return <div className="h-60" />;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) =>
            v >= 1000 ? `${currency === "USD" ? "$" : ""}${(v / 1000).toFixed(0)}k` : `${v}`
          }
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value), currency),
            name === "paid" ? "Paid" : "Pending",
          ]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
        />
        <Legend
          formatter={(value) => (value === "paid" ? "Paid" : "Pending")}
          wrapperStyle={{ fontSize: "12px" }}
        />
        <Area
          type="monotone"
          dataKey="paid"
          stroke="#4f46e5"
          strokeWidth={2}
          fill="url(#gradPaid)"
        />
        <Area
          type="monotone"
          dataKey="pending"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#gradPending)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
