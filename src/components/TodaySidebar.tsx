"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import type { Member, MemberColor, EventRow, ChoreCompletion } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";
import type { ChoreWithAssignees } from "@/lib/chores";
import { toggleChoreAction, verifyCompletionAction } from "@/app/actions";
import { useRequestPin } from "./PinPad";

export function TodaySidebar({
  members,
  chores,
  completionsByMember,
  eligibleByCompletion,
  streaks,
  events,
}: {
  members: Member[];
  chores: ChoreWithAssignees[];
  completionsByMember: Map<number, ChoreCompletion[]>;
  eligibleByCompletion: Map<number, number[]>;
  streaks: Map<number, number>;
  events: EventRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const requestPin = useRequestPin();

  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <aside className="w-[420px] border-l border-zinc-200 bg-white flex flex-col overflow-hidden shrink-0">
      <div className="px-6 py-4 border-b border-zinc-200">
        <div className="text-sm uppercase tracking-wider text-zinc-400">Today</div>
        <div className="text-2xl font-semibold">{format(new Date(), "EEEE, MMM d")}</div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        <section>
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Today's events</h3>
          {events.length === 0 ? (
            <div className="text-sm text-zinc-400 italic">Nothing scheduled.</div>
          ) : (
            <ul className="space-y-2">
              {events
                .sort((a, b) => a.start_ts - b.start_ts)
                .map((e) => {
                  const m = e.member_id ? memberById.get(e.member_id) : null;
                  const color = m ? COLOR_CLASSES[m.color as MemberColor] : COLOR_CLASSES.sky;
                  return (
                    <li key={e.id} className="flex items-start gap-3">
                      <div className={`w-2 h-2 mt-2 rounded-full ${color.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-medium truncate">{e.title}</div>
                        <div className="text-sm text-zinc-500 tabular-nums">
                          {e.all_day
                            ? "All day"
                            : `${format(new Date(e.start_ts * 1000), "h:mm a")} – ${format(new Date(e.end_ts * 1000), "h:mm a")}`}
                          {m && ` · ${m.name}`}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Chores today</h3>
          {members.map((m) => {
            const memberChores = chores.filter((c) => c.assignees.includes(m.id));
            if (memberChores.length === 0) return null;
            const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
            const comps = completionsByMember.get(m.id) ?? [];
            const compByChoreId = new Map(comps.map((c) => [c.chore_id, c]));
            const streak = streaks.get(m.id) ?? 0;
            return (
              <div key={m.id} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full ${color.bg} flex items-center justify-center text-sm text-white`}>
                    {m.emoji ?? m.name[0]}
                  </div>
                  <div className="font-medium">{m.name}</div>
                  {streak > 0 && (
                    <div className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                      🔥 {streak}
                    </div>
                  )}
                </div>
                <ul className="space-y-1.5 pl-1">
                  {memberChores.map((c) => {
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
                              await toggleChoreAction(c.id, m.id);
                              router.refresh();
                            })
                          }
                          disabled={pending}
                          className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg active:bg-zinc-100 ${
                            status === "verified" ? "opacity-60" : ""
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                              status === "verified"
                                ? `${color.bg} border-transparent text-white`
                                : status === "pending"
                                  ? `${color.border} bg-white border-dashed`
                                  : `${color.border} bg-white`
                            }`}
                          >
                            {status === "verified" && (
                              <svg viewBox="0 0 20 20" className="w-4 h-4 tick-pop" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            {status === "pending" && <div className="text-[9px]">⏳</div>}
                          </div>
                          <span className="text-sm">{c.icon}</span>
                          <span className={`flex-1 text-left text-sm ${status === "verified" ? "line-through text-zinc-400" : ""}`}>
                            {c.title}
                          </span>
                        </button>
                        {status === "pending" && comp && eligible.length > 0 && (
                          <div className="flex items-center gap-1 pl-8 mt-1">
                            {eligible.map((vid) => {
                              const v = memberById.get(vid);
                              if (!v) return null;
                              const vcol = COLOR_CLASSES[v.color as MemberColor] ?? COLOR_CLASSES.sky;
                              return (
                                <button
                                  key={vid}
                                  onClick={() =>
                                    start(async () => {
                                      const ok = await requestPin(v, "Verify chore", async (pin) => {
                                        return await verifyCompletionAction(comp.id, vid, pin || null);
                                      });
                                      if (ok) router.refresh();
                                    })
                                  }
                                  disabled={pending}
                                  className={`h-10 min-w-14 px-3 rounded-full ${vcol.bg} text-white text-sm flex items-center gap-1.5 active:opacity-80`}
                                >
                                  <span>{v.emoji ?? v.name[0]}</span>
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
              </div>
            );
          })}
        </section>
      </div>
    </aside>
  );
}
