"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

interface State extends ConfirmOptions {
  open: boolean;
  message: string;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ open: false, message: "" });
  const resolveRef = useRef<(v: boolean) => void>(() => {});

  const confirm: ConfirmFn = useCallback((message, options = {}) => {
    setState({ open: true, message, ...options });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleConfirm() {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current(true);
  }

  function handleCancel() {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current(false);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={handleCancel}
            />

            {/* Panel */}
            <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
              {/* Icon + title */}
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    state.danger ? "bg-red-100" : "bg-amber-100"
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "h-5 w-5",
                      state.danger ? "text-red-600" : "text-amber-600"
                    )}
                  />
                </div>
                <div className="min-w-0">
                  {state.title && (
                    <p className="text-base font-semibold text-slate-900 mb-1">
                      {state.title}
                    </p>
                  )}
                  <p className="text-sm text-slate-600 leading-relaxed">{state.message}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-1">
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  {state.cancelLabel ?? "Cancel"}
                </Button>
                <Button
                  size="sm"
                  variant={state.danger ? "danger" : "primary"}
                  onClick={handleConfirm}
                >
                  {state.confirmLabel ?? "Confirm"}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
