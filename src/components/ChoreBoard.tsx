"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { Member, MemberColor, ChoreCompletion, Reward } from "@/lib/types";
import { COLOR_CLASSES, displayName, memberGlyph } from "@/lib/types";
import type { ChoreWithAssignees } from "@/lib/chores";
import {
  toggleChoreAction,
  verifyCompletionAction,
  unverifyCompletionAction,
  redeemRewardAction,
} from "@/app/actions";
import { Sheet } from "./Sheet";
import { useRequestPin } from "./PinPad";

type PendingRow = ChoreCompletion & { chore: { id: number; title: string; icon: string | null; points: number; recurrence: string; active: number; created_at: number } };

export function ChoreBoard({
  members,
  todayChores,
  completionsByMember,
  weeklyStats,
  streaks,
  balances,
  pending,
  eligibleByCompletion,
  rewards,
}: {
  members: Member[];
  todayChores: ChoreWithAssignees[];
  completionsByMember: Map<number, ChoreCompletion[]>;
  weeklyStats: Map<number, { due: number; done: number }>;
  streaks: Map<number, number>;
  balances: Map<number, number>;
  pending: PendingRow[];
  eligibleByCompletion: Map<number, number[]>;
  rewards: Reward[];
}) {
  const router = useRouter();
  const [pendingT, start] = useTransition();
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [verifyPanelOpen, setVerifyPanelOpen] = useState(false);

  const today = new Date();
  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <div className="px-8 py-4 border-b border-zinc-200 bg-white flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">Chores</div>
          <div className="text-sm text-zinc-500">{format(today, "EEEE, MMMM d")}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVerifyPanelOpen(true)}
            className={`px-4 h-12 rounded-full border flex items-center gap-2 text-base active:bg-zinc-100 ${
              pending.length > 0 ? "border-amber-300 bg-amber-50" : "border-zinc-200"
            }`}
          >
            ⏳ Verify
            {pending.length > 0 && (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center tabular-nums">
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setRewardsOpen(true)}
            className="px-4 h-12 rounded-full border border-zinc-200 flex items-center gap-2 text-base active:bg-zinc-100"
          >
            🏆 Rewards
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div
          className="grid gap-6 h-full"
          style={{ gridTemplateColumns: `repeat(${Math.max(members.length, 1)}, minmax(0, 1fr))` }}
        >
          {members.map((m) => {
            const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
            const memberChores = todayChores.filter((c) => c.assignees.includes(m.id));
            const comps = completionsByMember.get(m.id) ?? [];
            const compByChoreId = new Map<number, ChoreCompletion>();
            for (const c of comps) compByChoreId.set(c.chore_id, c);
            const stats = weeklyStats.get(m.id) ?? { due: 0, done: 0 };
            const pct = stats.due > 0 ? Math.round((stats.done / stats.due) * 100) : 0;
            const streak = streaks.get(m.id) ?? 0;
            const balance = balances.get(m.id) ?? 0;
            const isChild = m.role === "child";
            const nextReward = rewards.filter((r) => r.points_cost > balance).sort((a, b) => a.points_cost - b.points_cost)[0];
            const affordable = rewards.filter((r) => r.points_cost <= balance);

            const pointsToday = memberChores
              .filter((c) => compByChoreId.get(c.id)?.verified_at)
              .reduce((s, c) => s + c.points, 0);
            const totalPoints = memberChores.reduce((s, c) => s + c.points, 0);

            return (
              <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200 flex flex-col overflow-hidden">
                <div className={`${color.bg} px-5 py-4 text-white flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    {m.photo_updated_at ? (
                      <img
                        src={`/api/avatar/${m.id}?v=${m.photo_updated_at}`}
                        alt={m.name}
                        className="w-12 h-12 rounded-full object-cover bg-white/20"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                        {memberGlyph(m)}
                      </div>
                    )}
                    <div>
                      <div className="text-xl font-semibold flex items-center gap-2">
                        {displayName(m)}
                        <span className="text-[10px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded">
                          {m.role}
                        </span>
                      </div>
                      <div className="text-sm opacity-80">{pointsToday}/{totalPoints} pts today · 🏆 {balance}</div>
                    </div>
                  </div>
                  {streak > 0 && (
                    <div className="bg-white/20 rounded-full px-3 py-1 text-sm">
                      🔥 {streak}
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                  {memberChores.length === 0 ? (
                    <div className="text-sm text-zinc-400 italic text-center py-8">
                      No chores today 🎉
                    </div>
                  ) : (
                    memberChores.map((c) => {
                      const comp = compByChoreId.get(c.id);
                      const status: "none" | "pending" | "verified" = !comp
                        ? "none"
                        : comp.verified_at
                          ? "verified"
                          : "pending";
                      const eligible = comp ? eligibleByCompletion.get(comp.id) ?? [] : [];

                      return (
                        <div key={c.id}>
                          <button
                            onClick={() =>
                              start(async () => {
                                await toggleChoreAction(c.id, m.id);
                                router.refresh();
                              })
                            }
                            disabled={pendingT}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                              status === "verified"
                                ? `${color.bgSoft} ${color.border} opacity-70`
                                : status === "pending"
                                  ? `bg-white ${color.border}`
                                  : "border-zinc-200 active:bg-zinc-50"
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
                                <svg viewBox="0 0 20 20" className="w-6 h-6 tick-pop" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                              {status === "pending" && <div className="text-xs">⏳</div>}
                            </div>
                            <div className="text-2xl">{c.icon}</div>
                            <div className={`flex-1 text-left font-medium ${status === "verified" ? "line-through text-zinc-400" : ""}`}>
                              {c.title}
                              {status === "pending" && (
                                <div className="text-xs text-amber-600 font-normal mt-0.5">Awaiting verification</div>
                              )}
                            </div>
                            <div className="text-sm text-zinc-400 tabular-nums">{c.points}pt</div>
                          </button>

                          {status === "pending" && comp && (
                            <div className="mt-1.5 mb-1 px-4 flex items-center gap-2">
                              <div className="text-xs text-zinc-500 mr-1">Verify:</div>
                              {eligible.map((vid) => {
                                const v = memberById.get(vid);
                                if (!v) return null;
                                return (
                                  <PinVerifyPill
                                    key={vid}
                                    verifier={v}
                                    completionId={comp.id}
                                    onDone={() => router.refresh()}
                                    disabled={pendingT}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {isChild && rewards.length > 0 && (
                  <div className="px-5 py-2 border-t border-zinc-100">
                    {nextReward ? (
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">
                          Next: {nextReward.icon} <span className="font-medium">{nextReward.title}</span> — {nextReward.points_cost - balance} pts to go
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.round((balance / nextReward.points_cost) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-emerald-600 font-medium">🎉 All rewards unlocked!</div>
                    )}
                    {affordable.length > 0 && (
                      <div className="mt-2 text-xs text-amber-600">
                        {affordable.length} reward{affordable.length === 1 ? "" : "s"} ready to redeem
                      </div>
                    )}
                  </div>
                )}

                <div className="px-5 py-3 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                    <span>This week</span>
                    <span className="tabular-nums">{stats.done} / {stats.due}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className={`h-full ${color.bg} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {verifyPanelOpen && (
        <VerifyPanel
          pending={pending}
          eligibleByCompletion={eligibleByCompletion}
          members={members}
          onClose={() => setVerifyPanelOpen(false)}
        />
      )}
      {rewardsOpen && (
        <RewardsShelf
          rewards={rewards}
          members={members}
          balances={balances}
          onClose={() => setRewardsOpen(false)}
        />
      )}
    </div>
  );
}

function PinVerifyPill({
  verifier,
  completionId,
  onDone,
  disabled,
}: {
  verifier: Member;
  completionId: number;
  onDone: () => void;
  disabled: boolean;
}) {
  const requestPin = useRequestPin();
  const [busy, setBusy] = useState(false);
  const vcol = COLOR_CLASSES[verifier.color as MemberColor] ?? COLOR_CLASSES.sky;
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          const ok = await requestPin(verifier, "Verify chore", async (pin) => {
            return await verifyCompletionAction(completionId, verifier.id, pin || null);
          });
          if (ok) onDone();
        } finally {
          setBusy(false);
        }
      }}
      disabled={disabled || busy}
      className={`h-11 min-w-16 px-4 rounded-full ${vcol.bg} text-white text-base font-medium flex items-center gap-1.5 active:opacity-80`}
    >
      <span>{memberGlyph(verifier)}</span>
      <span>✓</span>
    </button>
  );
}

function VerifyPanel({
  pending,
  eligibleByCompletion,
  members,
  onClose,
}: {
  pending: PendingRow[];
  eligibleByCompletion: Map<number, number[]>;
  members: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <Sheet open onClose={onClose} title={`Pending verifications (${pending.length})`} width="max-w-2xl">
      {pending.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 italic">All caught up! 🎉</div>
      ) : (
        <ul className="space-y-3">
          {pending.map((p) => {
            const doer = memberById.get(p.member_id);
            const doerColor = doer ? COLOR_CLASSES[doer.color as MemberColor] : COLOR_CLASSES.sky;
            const eligible = eligibleByCompletion.get(p.id) ?? [];
            return (
              <li key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200">
                <div className="text-3xl">{p.chore.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.chore.title}</div>
                  <div className="text-sm text-zinc-500 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${doerColor.dot}`} />
                    {doer?.name ?? "?"} · {format(new Date(p.completed_at * 1000), "MMM d, h:mm a")} · {p.chore.points}pt
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {eligible.map((vid) => {
                    const v = memberById.get(vid);
                    if (!v) return null;
                    return (
                      <PinVerifyPill
                        key={vid}
                        verifier={v}
                        completionId={p.id}
                        onDone={() => router.refresh()}
                        disabled={false}
                      />
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

function RewardsShelf({
  rewards,
  members,
  balances,
  onClose,
}: {
  rewards: Reward[];
  members: Member[];
  balances: Map<number, number>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const children = members.filter((m) => m.role === "child");
  const parents = members.filter((m) => m.role === "parent");
  const [activeMember, setActiveMember] = useState<number | null>(children[0]?.id ?? null);

  const balance = activeMember != null ? (balances.get(activeMember) ?? 0) : 0;

  const requestPin = useRequestPin();
  const redeem = async (rewardId: number, cost: number) => {
    if (activeMember == null) return;
    if (parents.length === 0) {
      alert("Add a parent first — rewards need parent approval.");
      return;
    }
    const chooseParent = () => {
      if (parents.length === 1) return parents[0];
      const labels = parents.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
      const raw = prompt(`Which parent is approving?\n${labels}\nEnter number:`);
      const idx = Number(raw) - 1;
      return parents[idx];
    };
    const approver = chooseParent();
    if (!approver) return;
    if (!confirm(`Redeem for ${cost} pts?`)) return;
    setBusy(true);
    try {
      const ok = await requestPin(approver, "Approve reward redemption", async (pin) => {
        return await redeemRewardAction({
          rewardId,
          memberId: activeMember,
          approvedBy: approver.id,
          pin: pin || null,
        });
      });
      if (ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="🏆 Rewards shelf" width="max-w-3xl">
      <div className="space-y-4">
        {children.length === 0 ? (
          <div className="text-center py-4 text-zinc-500 italic">
            No children yet. Add family members with role &ldquo;child&rdquo; in Settings.
          </div>
        ) : (
          <div className="flex gap-2 items-center">
            <div className="text-sm text-zinc-500">Redeeming for:</div>
            {children.map((c) => {
              const color = COLOR_CLASSES[c.color as MemberColor] ?? COLOR_CLASSES.sky;
              const selected = activeMember === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveMember(c.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${
                    selected ? `${color.bg} ${color.border} text-white` : "border-zinc-200"
                  }`}
                >
                  <span>{memberGlyph(c)}</span>
                  <span>{c.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${selected ? "bg-white/20" : "bg-amber-100 text-amber-700"} tabular-nums`}>
                    🏆 {balances.get(c.id) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {rewards.length === 0 && (
            <div className="col-span-2 text-center py-8 text-zinc-400 italic">
              No rewards yet — add some in Settings → Rewards.
            </div>
          )}
          {rewards.map((r) => {
            const affordable = balance >= r.points_cost && activeMember != null;
            return (
              <div key={r.id} className="border border-zinc-200 rounded-xl p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="text-4xl">{r.icon ?? "🎁"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{r.title}</div>
                    {r.description && <div className="text-xs text-zinc-500">{r.description}</div>}
                  </div>
                  <div className="text-lg font-semibold text-amber-600 tabular-nums shrink-0">{r.points_cost}</div>
                </div>
                <button
                  onClick={() => redeem(r.id, r.points_cost)}
                  disabled={busy || !affordable}
                  className={`mt-3 py-2.5 rounded-xl font-medium text-sm ${
                    affordable ? "bg-emerald-600 text-white active:bg-emerald-700" : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  {activeMember == null ? "Pick a child" : affordable ? "Redeem" : `${r.points_cost - balance} more pts`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
