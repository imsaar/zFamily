"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * App-wide replacement for the browser's confirm()/alert(). Provides
 * promise-based `confirm()` and `alert()` that render a styled modal, so no
 * native dialogs appear anywhere in the app (important on the kiosk, where
 * browser chrome is hidden).
 */

type Kind = "confirm" | "alert";

type Request = {
  kind: Kind;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type AlertOptions = { title?: string; message: string; confirmLabel?: string };

const Ctx = createContext<{
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  alert: (o: AlertOptions) => Promise<void>;
} | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setReq({ kind: "confirm", ...o, resolve })),
    []
  );
  const alert = useCallback(
    (o: AlertOptions) => new Promise<void>((resolve) => setReq({ kind: "alert", ...o, resolve: () => resolve() })),
    []
  );

  const close = (ok: boolean) => {
    setReq((r) => {
      r?.resolve(ok);
      return null;
    });
  };

  return (
    <Ctx.Provider value={{ confirm, alert }}>
      {children}
      {req && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 fade-in" onClick={() => close(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-6 p-6 fade-in">
            {req.title && <div className="text-xl font-semibold mb-1.5">{req.title}</div>}
            <div className="text-zinc-600 whitespace-pre-wrap leading-relaxed">{req.message}</div>
            <div className="mt-6 flex gap-3 justify-end">
              {req.kind === "confirm" && (
                <button
                  onClick={() => close(false)}
                  className="px-5 py-2.5 rounded-xl border border-zinc-300 font-medium active:bg-zinc-100"
                >
                  {req.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button
                onClick={() => close(true)}
                className={`px-5 py-2.5 rounded-xl font-medium text-white ${
                  req.danger ? "bg-red-600 active:bg-red-700" : "bg-zinc-900 active:bg-zinc-800"
                }`}
              >
                {req.confirmLabel ?? (req.kind === "alert" ? "OK" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
