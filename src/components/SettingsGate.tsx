"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth, type AdminAuth } from "./AdminGate";
import { usePinAuth } from "./PinPad";
import { SettingsAuthProvider } from "./SettingsAuth";
import { verifyAdminAction } from "@/app/actions";

/** Gates the whole Settings screen behind a single parent-PIN unlock. Once
 *  unlocked, the parent's auth is shared to every tab via SettingsAuthProvider
 *  so saves don't re-prompt. Leaving Settings unmounts this and clears the
 *  cached PIN, so returning requires the PIN again. */
export function SettingsGate({ children }: { children: React.ReactNode }) {
  const { authenticate, modal } = useAdminAuth();
  const { clear } = usePinAuth();
  const [auth, setAuth] = useState<AdminAuth | null>(null);
  const startedRef = useRef(false);

  const unlock = useCallback(() => {
    void authenticate(async (a) => {
      const r = await verifyAdminAction(a);
      if (r.ok) setAuth(a);
      return r;
    });
  }, [authenticate]);

  // Auto-prompt for the PIN as soon as Settings opens (guarded so React's
  // dev double-invoke doesn't prompt twice).
  useEffect(() => {
    if (!startedRef.current && !auth) {
      startedRef.current = true;
      unlock();
    }
  }, [auth, unlock]);

  // Leaving Settings ends the session — drop the parent's cached PIN so the
  // next visit re-prompts.
  useEffect(() => {
    return () => {
      if (auth) clear(auth.by);
    };
  }, [auth, clear]);

  if (auth) return <SettingsAuthProvider auth={auth}>{children}</SettingsAuthProvider>;

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="text-6xl">🔒</div>
      <div className="mt-4 text-2xl font-semibold">Settings are locked</div>
      <div className="mt-1 text-zinc-500">A parent PIN is required to open Settings.</div>
      <button
        onClick={unlock}
        className="mt-6 px-6 py-3 rounded-xl bg-zinc-900 text-white font-medium active:bg-zinc-800"
      >
        Enter parent PIN
      </button>
      {modal}
    </div>
  );
}
