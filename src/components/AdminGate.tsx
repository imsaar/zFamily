"use client";

import { useCallback, useRef, useState } from "react";
import { useParents } from "./PinProviders";
import { usePinAuth, PinPadModal } from "./PinPad";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";

export type AdminAuth = { by: number; pin: string };

type Executor = (auth: AdminAuth) => Promise<{ ok: boolean; reason?: string }>;

/** Hook: obtain an admin auth (parent id + PIN) before running a parent-only
 *  action. Renders its own combined "which parent + PIN" modal.
 *
 *  Reliability notes:
 *  - Does NOT use useTransition — that has been observed to interact badly
 *    with awaited state updates in React 19 when saved inside a form's
 *    save handler.
 *  - Returns a Promise<boolean> so callers can `await authenticate(...)`.
 */
export function useAdminAuth() {
  const parents = useParents();
  const { getPin, savePin, clear } = usePinAuth();
  const [state, setState] = useState<null | {
    parent: Member | null; // null = still picking (only when 2+ parents)
    executor: Executor;
    resolve: (ok: boolean) => void;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);

  // Run the executor with (parent, pin). Handles success (cache pin, close,
  // resolve true), failure (clear cache, show error, keep modal open for
  // retry).
  const run = useCallback(
    async (parent: Member, pin: string, executor: Executor, resolve: (ok: boolean) => void) => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const result = await executor({ by: parent.id, pin });
        if (result.ok) {
          savePin(parent.id, pin);
          setState(null);
          setError(null);
          resolve(true);
        } else {
          clear(parent.id);
          setError(result.reason ?? "pin_invalid");
          // stay open so user can retry
        }
      } finally {
        runningRef.current = false;
      }
    },
    [savePin, clear]
  );

  const authenticate = useCallback(
    (executor: Executor): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        if (parents.length === 0) {
          alert("Add a parent first — admin actions require parent approval.");
          resolve(false);
          return;
        }

        // Fast path: any parent already has a cached (unexpired) PIN.
        const cached = parents.find((p) => getPin(p.id));
        if (cached) {
          const pin = getPin(cached.id)!;
          void run(cached, pin, executor, resolve);
          return;
        }

        // No cache → open the modal. If only one parent, skip the picker.
        const initial: Member | null = parents.length === 1 ? parents[0] : null;
        setError(null);
        setState({ parent: initial, executor, resolve });
      });
    },
    [parents, getPin, run]
  );

  const pickParent = (p: Member) => {
    setError(null);
    setState((s) => (s ? { ...s, parent: p } : s));
  };

  const submitPin = (pin: string) => {
    if (!state || !state.parent) return;
    void run(state.parent, pin, state.executor, state.resolve);
  };

  const cancel = () => {
    if (!state) return;
    const resolver = state.resolve;
    setState(null);
    setError(null);
    resolver(false);
  };

  let modal: React.ReactNode = null;
  if (state) {
    if (!state.parent) {
      modal = <ParentPicker parents={parents} onPick={pickParent} onCancel={cancel} />;
    } else {
      modal = (
        <PinPadModal
          key={state.parent.id}
          member={state.parent}
          purpose="Admin action — parent PIN"
          error={error}
          onSubmit={submitPin}
          onCancel={cancel}
        />
      );
    }
  }

  return { authenticate, modal };
}

function ParentPicker({
  parents,
  onPick,
  onCancel,
}: {
  parents: Member[];
  onPick: (m: Member) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 fade-in" onClick={onCancel} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-6 overflow-hidden fade-in">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Which parent?</div>
            <div className="text-sm text-zinc-500">Choose the parent authorizing this action.</div>
          </div>
          <button
            onClick={onCancel}
            className="w-12 h-12 rounded-full text-3xl text-zinc-500 hover:bg-zinc-100"
            aria-label="Cancel"
          >
            ×
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 gap-3">
          {parents.map((p) => {
            const color = COLOR_CLASSES[p.color as MemberColor] ?? COLOR_CLASSES.sky;
            return (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 ${color.border} bg-white active:bg-zinc-50`}
              >
                <div className={`w-14 h-14 rounded-full ${color.bg} flex items-center justify-center text-2xl text-white shrink-0`}>
                  {p.emoji ?? p.name[0]}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-lg font-semibold">{p.name}</div>
                  <div className="text-sm text-zinc-500">Tap to select</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
