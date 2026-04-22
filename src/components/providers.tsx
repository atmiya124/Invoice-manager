"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmDialogProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !shadow-lg !border !border-slate-200 !bg-white !text-slate-900",
              description: "!text-slate-500",
              actionButton: "!bg-indigo-600 !text-white",
              cancelButton: "!bg-slate-100 !text-slate-700",
              error: "!border-red-200 !bg-red-50 !text-red-800",
              success: "!border-emerald-200 !bg-emerald-50 !text-emerald-800",
            },
          }}
        />
      </ConfirmDialogProvider>
    </SessionProvider>
  );
}
