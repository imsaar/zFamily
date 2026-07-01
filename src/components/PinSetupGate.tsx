"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";
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
  const [active, setActive] = useState<Member | null>(parentsNeedingPin[0] ?? null);
  const [phase, setPhase] = useState<"choose" | "confirm">("choose");
  const [chosenPin, setChosenPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (parentsNeedingPin.length === 0) return null;

  const dismiss = () => {
    // no cancel possible from this gate; ignore
  };

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
        {parentsNeedingPin.map((p) => {
          const color = COLOR_CLASSES[p.color as MemberColor] ?? COLOR_CLASSES.sky;
          const isActive = active?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setActive(p);
                setPhase("choose");
                setChosenPin(null);
                setError(null);
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                isActive ? `${color.border} bg-white shadow-lg scale-105` : "border-zinc-200 opacity-60"
              }`}
            >
              <div className={`w-20 h-20 rounded-full ${color.bg} flex items-center justify-center text-4xl text-white`}>
                {p.emoji ?? p.name[0]}
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
          onCancel={dismiss}
          error={error}
        />
      )}
    </div>
  );
}
