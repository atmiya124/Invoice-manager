import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/types";

const statusConfig: Record<
  InvoiceStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  SENT: {
    label: "Sent",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  PAID: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
};

interface BadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export function StatusBadge({ status, className }: BadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

// Generic badge
interface GenericBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const variantClasses = {
  default: "bg-slate-100 text-slate-700 ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
};

export function Badge({
  children,
  variant = "default",
  className,
}: GenericBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
