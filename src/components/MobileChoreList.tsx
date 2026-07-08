"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleChoreAction, verifyCompletionAction } from "@/app/actions";
import { useRequestPin } from "./PinPad";
import type { ChoreWithAssignees } from "@/lib/chores";
import type { ChoreCompletion, Member } from "@/lib/types";
import { COLOR_CLASSES, type MemberColor, memberGlyph } from "@/lib/types";

export function MobileChoreList({
  memberId,
  colorKey,
  chores,
  completions,
  eligibleByCompletion,
  members,
}: {
  memberId: number;
  colorKey: MemberColor;
  chores: ChoreWithAssignees[];
  completions: ChoreCompletion[];
  eligibleByCompletion: Map<number, number[]>;
  members: Member[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const requestPin = useRequestPin();
  const color = COLOR_CLASSES[colorKey] ?? COLOR_CLASSES.sky;
  const memberById = new Map(members.map((m) => [m.id, m]));
  const compByChoreId = new Map(completions.map((c) => [c.chore_id, c]));

  if (chores.length === 0) {
    return <div className="p-8 text-center text-zinc-400">No chores today 🎉</div>;
  }

  return (
    <ul className="p-5 space-y-2">
      {chores.map((c) => {
        const comp = compByChoreId.get(c.id);
        const status: "none" | "pending" | "verified" = !comp
          ? "none"
          : comp.verified_at
            ? "verified"
            : "pending";
        const eligible = comp ? eligibleByCompletion.get(comp.id) ?? [] : [];
        return (
          <li key={c.id}>
            <button
              onClick={() =>
                start(async () => {
                  await toggleChoreAction(c.id, memberId);
                  router.refresh();
                })
              }
              disabled={pending}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                status === "verified"
                  ? `${color.bgSoft} ${color.border} opacity-70`
                  : status === "pending"
                    ? `bg-white ${color.border}`
                    : "border-zinc-200 bg-white active:bg-zinc-50"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  status === "verified"
                    ? `${color.bg} border-transparent text-white`
                    : status === "pending"
                      ? `${color.border} bg-white border-dashed`
                      : `${color.border} bg-white`
                }`}
              >
                {status === "verified" && (
                  <svg viewBox="0 0 20 20" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {status === "pending" && <div className="text-xs">⏳</div>}
              </div>
              <div className="text-2xl">{c.icon}</div>
              <div className={`flex-1 text-left ${status === "verified" ? "line-through text-zinc-400" : ""}`}>
                <div className="font-medium">{c.title}</div>
                {status === "pending" && (
                  <div className="text-xs text-amber-600">Awaiting verification</div>
                )}
              </div>
              <div className="text-sm text-zinc-400">{c.points}pt</div>
            </button>
            {status === "pending" && comp && eligible.length > 0 && (
              <div className="mt-2 pl-4 flex items-center gap-2">
                <div className="text-xs text-zinc-500 mr-1">Verify:</div>
                {eligible.map((vid) => {
                  const v = memberById.get(vid);
                  if (!v) return null;
                  const vcol = COLOR_CLASSES[v.color as MemberColor] ?? COLOR_CLASSES.sky;
                  return (
                    <button
                      key={vid}
                      onClick={async () => {
                        const ok = await requestPin(v, "Verify chore", async (pin) => {
                          return await verifyCompletionAction(comp.id, vid, pin || null);
                        });
                        if (ok) router.refresh();
                      }}
                      disabled={pending}
                      className={`h-12 min-w-16 px-4 rounded-full ${vcol.bg} text-white text-base font-medium flex items-center gap-1.5 active:opacity-80`}
                    >
                      <span>{memberGlyph(v)}</span>
                      <span>✓</span>
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
