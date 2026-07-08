"use client";

import { createContext, useContext, useCallback } from "react";
import type { AdminAuth } from "./AdminGate";

type Executor = (auth: AdminAuth) => Promise<{ ok: boolean; reason?: string }>;

const SettingsAuthContext = createContext<AdminAuth | null>(null);

export function SettingsAuthProvider({ auth, children }: { auth: AdminAuth; children: React.ReactNode }) {
  return <SettingsAuthContext.Provider value={auth}>{children}</SettingsAuthContext.Provider>;
}

/** Drop-in replacement for `useAdminAuth` used *inside* the Settings screen.
 *  Access is authorized once at the Settings entry (see SettingsGate); every
 *  save here reuses that parent's auth silently — no further PIN prompts until
 *  the user leaves Settings. Shares the { authenticate, modal } shape so call
 *  sites don't change (modal is always null since nothing prompts here). */
export function useSettingsAuth() {
  const auth = useContext(SettingsAuthContext);
  const authenticate = useCallback(
    async (executor: Executor): Promise<boolean> => {
      if (!auth) return false;
      const r = await executor(auth);
      return r.ok;
    },
    [auth]
  );
  return { authenticate, modal: null as React.ReactNode };
}
