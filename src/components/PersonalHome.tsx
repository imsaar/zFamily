"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { Member, MemberColor, EventRow, ChoreCompletion, Reward } from "@/lib/types";
import { COLOR_CLASSES, displayName } from "@/lib/types";
import type { ChoreWithAssignees } from "@/lib/chores";
import type { Meal, ProposalWithVotes } from "@/lib/meals";
import { toggleChoreAction, verifyCompletionAction, toggleVoteAction, proposeMealAction } from "@/app/actions";
import { useRequestPin } from "./PinPad";

export function PersonalHome({
  member,
  allMembers,
  chores,
  completions,
  eligibleByCompletion,
  streak,
  balance,
  events,
  proposals,
  meals,
  weekStart,
  rewards,
  idleSeconds,
}: {
  member: Member;
  allMembers: Member[];
  chores: ChoreWithAssignees[];
  completions: ChoreCompletion[];
  eligibleByCompletion: Map<number, number[]>;
  streak: number;
  balance: { earned: number; spent: number; balance: number };
  events: EventRow[];
  proposals: ProposalWithVotes[];
  meals: Meal[];
  weekStart: string;
  rewards: Reward[];
  idleSeconds: number;
}) {
  useIdleRevert(idleSeconds);
  const router = useRouter();
  const [pending, start] = useTransition();
  const requestPin = useRequestPin();
  const color = COLOR_CLASSES[member.color as MemberColor] ?? COLOR_CLASSES.sky;
  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  const compByChoreId = new Map(completions.map((c) => [c.chore_id, c]));

  const nextReward = rewards.filter((r) => r.points_cost > balance.balance).sort((a, b) => a.points_cost - b.points_cost)[0];

  return (
    <div className="h-full flex bg-zinc-50">
      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className={`${color.bg} text-white px-6 py-5 flex items-center gap-4 shrink-0`}>
          <Link href="/" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            ‹
          </Link>
          {member.photo_updated_at ? (
            <img
              src={`/api/avatar/${member.id}?v=${member.photo_updated_at}`}
              alt={member.name}
              className="w-16 h-16 rounded-full object-cover bg-white/20 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl shrink-0">
              {member.emoji ?? member.name[0]}
            </div>
          )}
          <div className="flex-1">
            <div className="text-3xl font-semibold flex items-center gap-3">
              {displayName(member)}&apos;s view
              {streak > 0 && <span className="text-lg bg-white/20 px-2.5 py-0.5 rounded-full">🔥 {streak}</span>}
              {member.role === "child" && (
                <span className="text-lg bg-white/20 px-2.5 py-0.5 rounded-full">🏆 {balance.balance}</span>
              )}
            </div>
            <div className="text-sm opacity-80">{format(new Date(), "EEEE, MMMM d")}</div>
          </div>
          <div className="text-sm opacity-70">Reverts in {Math.round(idleSeconds / 60)} min idle</div>
        </div>

        <section className="p-6">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">My chores today</div>
          {chores.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-400 italic">
              Nothing to do today 🎉
            </div>
          ) : (
            <ul className="space-y-2">
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
                          await toggleChoreAction(c.id, member.id);
                          router.refresh();
                        })
                      }
                      disabled={pending}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all bg-white ${
                        status === "verified"
                          ? `${color.bgSoft} ${color.border} opacity-70`
                          : status === "pending"
                            ? `${color.border}`
                            : "border-zinc-200 active:bg-zinc-50"
                      }`}
                    >
                      <div
                        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          status === "verified"
                            ? `${color.bg} border-transparent text-white`
                            : status === "pending"
                              ? `${color.border} bg-white border-dashed`
                              : `${color.border} bg-white`
                        }`}
                      >
                        {status === "verified" && (
                          <svg viewBox="0 0 20 20" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {status === "pending" && <div className="text-sm">⏳</div>}
                      </div>
                      <div className="text-3xl">{c.icon}</div>
                      <div className="flex-1 text-left">
                        <div className={`font-medium text-lg ${status === "verified" ? "line-through text-zinc-400" : ""}`}>{c.title}</div>
                        {status === "pending" && <div className="text-sm text-amber-600 mt-0.5">Awaiting verification</div>}
                      </div>
                      <div className="text-sm text-zinc-400 tabular-nums">{c.points}pt</div>
                    </button>
                    {status === "pending" && comp && eligible.length > 0 && (
                      <div className="mt-2 pl-6 flex items-center gap-2">
                        <div className="text-xs text-zinc-500">Ask a parent to verify:</div>
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
                              className={`h-11 min-w-16 px-4 rounded-full ${vcol.bg} text-white text-base font-medium flex items-center gap-1.5 active:opacity-80`}
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
          )}
        </section>

        <section className="px-6 pb-6">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">My schedule (next 7 days)</div>
          {events.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 text-center text-zinc-400 italic">
              Nothing on your calendar.
            </div>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className={`bg-white rounded-xl border-l-4 ${color.border} border-y border-r border-zinc-200 px-4 py-3 flex items-center gap-3`}>
                  <div className="text-sm text-zinc-500 tabular-nums w-32 shrink-0">
                    {format(new Date(e.start_ts * 1000), "EEE, MMM d")}
                    {!e.all_day && (
                      <div className="text-xs opacity-70">
                        {format(new Date(e.start_ts * 1000), "h:mm a")}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.title}</div>
                    {e.location && <div className="text-xs text-zinc-500 truncate">📍 {e.location}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right column: meal voting + rewards */}
      <div className="w-[480px] shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-y-auto">
        <div className="px-6 py-5 border-b border-zinc-200">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">🗳️ Vote for next week's meals</div>
          <p className="text-sm text-zinc-500 mt-1">Tap 👍 on the meals you want.</p>
        </div>

        <div className="px-4 py-3 space-y-2 border-b border-zinc-100">
          {proposals.length === 0 ? (
            <div className="text-sm text-zinc-400 italic p-3">No candidates yet.</div>
          ) : (
            [...proposals]
              .sort((a, b) => b.votes.length - a.votes.length)
              .map((p) => {
                const voted = new Set(p.votes).has(member.id);
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200">
                    <div className="text-2xl">{p.meal.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.meal.name}</div>
                      <div className="text-xs text-zinc-500">{p.votes.length} vote{p.votes.length === 1 ? "" : "s"}</div>
                    </div>
                    <button
                      onClick={async () => {
                        const ok = await requestPin(member, voted ? "Withdraw vote" : "Cast vote", async (pin) => {
                          return await toggleVoteAction(p.id, member.id, !voted, pin || null);
                        });
                        if (ok) router.refresh();
                      }}
                      disabled={pending}
                      className={`h-11 min-w-16 px-4 rounded-full font-medium text-base ${
                        voted ? `${color.bg} text-white` : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {voted ? "👍 Voted" : "👍"}
                    </button>
                  </div>
                );
              })
          )}
        </div>

        <details className="border-b border-zinc-100">
          <summary className="px-6 py-3 text-sm font-medium cursor-pointer active:bg-zinc-50">
            + Suggest a meal from library
          </summary>
          <div className="p-4 grid grid-cols-2 gap-2">
            {meals
              .filter((m) => !proposals.some((p) => p.meal_id === m.id))
              .slice(0, 12)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() =>
                    start(async () => {
                      await proposeMealAction(m.id, weekStart);
                      router.refresh();
                    })
                  }
                  disabled={pending}
                  className="p-2 rounded-lg border border-zinc-200 text-left hover:bg-zinc-50"
                >
                  <div className="text-2xl">{m.icon}</div>
                  <div className="text-sm truncate">{m.name}</div>
                </button>
              ))}
          </div>
        </details>

        {member.role === "child" && rewards.length > 0 && (
          <div className="px-6 py-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">🏆 My rewards</div>
            {nextReward && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
                <div className="text-sm text-amber-900">
                  Next up: {nextReward.icon} <b>{nextReward.title}</b>
                </div>
                <div className="text-xs text-amber-700 mt-1 tabular-nums">
                  {nextReward.points_cost - balance.balance} more pts to unlock ({balance.balance} / {nextReward.points_cost})
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/60 overflow-hidden">
                  <div className={`h-full ${color.bg}`} style={{ width: `${Math.min(100, (balance.balance / nextReward.points_cost) * 100)}%` }} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              {rewards.map((r) => {
                const affordable = balance.balance >= r.points_cost;
                return (
                  <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border ${affordable ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"}`}>
                    <div className="text-2xl">{r.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${affordable ? "text-emerald-900" : ""}`}>{r.title}</div>
                      {r.description && <div className="text-xs text-zinc-500 truncate">{r.description}</div>}
                    </div>
                    <div className={`text-sm font-semibold tabular-nums ${affordable ? "text-emerald-700" : "text-zinc-500"}`}>{r.points_cost}pt</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-zinc-500 italic">Ask a parent from the Chores tab to redeem.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function useIdleRevert(idleSeconds: number) {
  const router = useRouter();
  const lastActivity = useRef(Date.now());
  const [remaining, setRemaining] = useState(idleSeconds);

  useEffect(() => {
    const bump = () => {
      lastActivity.current = Date.now();
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"];
    for (const e of events) window.addEventListener(e, bump, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, bump);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const idle = (Date.now() - lastActivity.current) / 1000;
      setRemaining(Math.max(0, Math.round(idleSeconds - idle)));
      if (idle >= idleSeconds) {
        router.push("/");
      }
    }, 2000);
    return () => clearInterval(t);
  }, [idleSeconds, router]);

  // We could surface `remaining` visually — not required for MVP.
  void remaining;
}
