"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES, memberGlyph } from "@/lib/types";
import { PinPadModal } from "./PinPad";
import { setMemberPinAction } from "@/app/actions";

/** Full-screen blocker shown when any parent has no PIN set.
 *  Requires each parent to set their PIN before the family can use the app. */
export function PinSetupGate({
  parentsNeedingPin,
}: {
  parentsNeedingPin: Member[];
}) {
  const router = useRouter();
  // Parents we've set a PIN for in this session. Tracked locally so we advance
  // to the next parent immediately, without waiting for the server refresh to
  // drop them from `parentsNeedingPin` — otherwise a just-completed parent
  // would be re-prompted and rejected (they now require their current PIN),
  // producing an endless choose/confirm loop.
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [phase, setPhase] = useState<"choose" | "confirm">("choose");
  const [chosenPin, setChosenPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = parentsNeedingPin.filter((p) => !doneIds.has(p.id));
  const active = remaining.find((p) => p.id === activeId) ?? remaining[0] ?? null;

  // Whenever the effective active parent changes (first render, after finishing
  // one parent, or after tapping another), restart their entry flow cleanly.
  useEffect(() => {
    if (active && active.id !== activeId) {
      setActiveId(active.id);
      setPhase("choose");
      setChosenPin(null);
      setError(null);
    }
  }, [active, activeId]);

  if (remaining.length === 0) return null;

  const onSubmit = async (pin: string) => {
    if (!active) return;
    if (phase === "choose") {
      setChosenPin(pin);
      setPhase("confirm");
      return;
    }
    if (pin !== chosenPin) {
      setError("pin_invalid");
      setPhase("choose");
      setChosenPin(null);
      return;
    }
    const r = await setMemberPinAction(active.id, pin);
    if (!r.ok) {
      setError(r.reason ?? "pin_invalid");
      setPhase("choose");
      setChosenPin(null);
      return;
    }
    // Success: mark this parent done so we advance to the next one, reset the
    // entry flow, and refresh so the server drops them from the gate.
    setDoneIds((prev) => new Set(prev).add(active.id));
    setError(null);
    setChosenPin(null);
    setPhase("choose");
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-[55] bg-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center mb-8">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-4xl font-semibold mb-2">Set up parent PINs</h1>
        <p className="text-lg text-zinc-600">
          Before the family can use zFamily, each parent needs a 4-digit PIN.
          The PIN protects admin actions and authorizes chore verification.
        </p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        {remaining.map((p) => {
          const color = COLOR_CLASSES[p.color as MemberColor] ?? COLOR_CLASSES.sky;
          const isActive = active?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setActiveId(p.id);
                setPhase("choose");
                setChosenPin(null);
                setError(null);
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                isActive ? `${color.border} bg-white shadow-lg scale-105` : "border-zinc-200 opacity-60"
              }`}
            >
              <div className={`w-20 h-20 rounded-full ${color.bg} flex items-center justify-center text-4xl text-white`}>
                {memberGlyph(p)}
              </div>
              <div className="text-lg font-semibold">{p.name}</div>
              <div className="text-xs text-zinc-500">Needs PIN</div>
            </button>
          );
        })}
      </div>

      {active && (
        <PinPadModal
          key={`${active.id}-${phase}`}
          member={active}
          purpose={phase === "choose" ? "Choose a 4-digit PIN" : "Confirm your PIN"}
          onSubmit={onSubmit}
          onCancel={() => {
            // No cancel path from this gate — a PIN is required to proceed.
          }}
          error={error}
        />
      )}
    </div>
  );
}
