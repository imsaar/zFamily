"use client";

import { useCallback, useState } from "react";
import { useParents } from "./PinProviders";
import { useRequestPin, usePinAuth } from "./PinPad";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";

export type AdminAuth = { by: number; pin: string };

/** Hook: obtain an admin auth (parent id + PIN) before performing a
 *  parent-only action. Prompts parent picker if there are multiple parents;
 *  reuses cached PIN if available; loops on invalid PIN. */
export function useAdminAuth() {
  const parents = useParents();
  const requestPin = useRequestPin();
  const { getPin } = usePinAuth();
  const [pickerState, setPickerState] = useState<{
    resolve: (m: Member | null) => void;
  } | null>(null);

  const authenticate = useCallback(
    async (
      executor: (auth: AdminAuth) => Promise<{ ok: boolean; reason?: string }>
    ): Promise<boolean> => {
      if (parents.length === 0) {
        alert("Add a parent first — admin actions require parent approval.");
        return false;
      }
      let parent: Member | null = parents[0];
      if (parents.length > 1) {
        // Prefer a parent that we already have a cached PIN for.
        const cached = parents.find((p) => getPin(p.id));
        if (cached) parent = cached;
        else {
          parent = await new Promise<Member | null>((resolve) => setPickerState({ resolve }));
          if (!parent) return false;
        }
      }
      const ok = await requestPin(parent, "Admin action — parent PIN", async (pin) => {
        return await executor({ by: parent!.id, pin: pin || "" });
      });
      return ok;
    },
    [parents, getPin, requestPin]
  );

  const modal = pickerState ? (
    <ParentPicker
      parents={parents}
      onPick={(m) => {
        pickerState.resolve(m);
        setPickerState(null);
      }}
    />
  ) : null;

  return { authenticate, modal };
}

function ParentPicker({ parents, onPick }: { parents: Member[]; onPick: (m: Member | null) => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 fade-in" onClick={() => onPick(null)} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-6 overflow-hidden fade-in">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Which parent?</div>
            <div className="text-sm text-zinc-500">Choose the parent authorizing this action.</div>
          </div>
          <button
            onClick={() => onPick(null)}
            className="w-11 h-11 rounded-full text-2xl text-zinc-500 hover:bg-zinc-100"
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
