"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Meal, ProposalWithVotes } from "@/lib/meals";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES, memberGlyph } from "@/lib/types";
import {
  applyWinnersAction,
  proposeMealAction,
  removeProposalAction,
  toggleVoteAction,
} from "@/app/actions";
import { useRequestPin } from "./PinPad";

export function MobileVote({
  weekStart,
  proposals,
  meals,
  members,
}: {
  weekStart: string;
  proposals: ProposalWithVotes[];
  meals: Meal[];
  members: Member[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  const ranked = [...proposals].sort((a, b) => {
    if (b.votes.length !== a.votes.length) return b.votes.length - a.votes.length;
    return a.created_at - b.created_at;
  });
  const proposedMealIds = new Set(proposals.map((p) => p.meal_id));

  const apply = () => {
    if (!confirm("Fill next week's dinners with the top-voted meals?")) return;
    start(async () => {
      const r = await applyWinnersAction(weekStart, false);
      alert(`Filled ${r.filled} dinner slot${r.filled === 1 ? "" : "s"}.`);
      router.push("/m");
    });
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 p-4 space-y-3 overflow-y-auto pb-32">
        {ranked.length === 0 && (
          <div className="text-center text-zinc-400 py-8 italic">
            No candidates yet.
            <br />
            Tap "+ Propose a meal" to start.
          </div>
        )}
        {ranked.map((p, i) => (
          <MobileProposalCard
            key={p.id}
            proposal={p}
            rank={i}
            members={members}
            pending={pending}
          />
        ))}
      </div>

      <div className="p-4 border-t border-zinc-200 bg-white space-y-2 fixed bottom-0 left-0 right-0">
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-700 font-medium"
        >
          + Propose a meal
        </button>
        {ranked.length > 0 && (
          <button
            onClick={apply}
            disabled={pending}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-40"
          >
            🍽️ Apply top {Math.min(ranked.length, 7)} to plan
          </button>
        )}
      </div>

      {adding && (
        <MobileProposeSheet
          meals={meals}
          weekStart={weekStart}
          alreadyProposed={proposedMealIds}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function MobileProposalCard({
  proposal,
  rank,
  members,
  pending,
}: {
  proposal: ProposalWithVotes;
  rank: number;
  members: Member[];
  pending: boolean;
}) {
  const router = useRouter();
  const [voting, start] = useTransition();
  const requestPin = useRequestPin();
  const voters = new Set(proposal.votes);
  const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-3xl">{proposal.meal.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {medal && <span className="text-lg">{medal}</span>}
            <div className="font-semibold truncate">{proposal.meal.name}</div>
            {proposal.meal.is_favorite && <span className="text-sm">❤️</span>}
          </div>
          <div className="text-xs text-zinc-500">
            {proposal.votes.length} vote{proposal.votes.length === 1 ? "" : "s"}
          </div>
        </div>
        <button
          onClick={() =>
            start(async () => {
              await removeProposalAction(proposal.id);
              router.refresh();
            })
          }
          disabled={pending || voting}
          className="w-9 h-9 text-zinc-300 text-xl"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {members.map((m) => {
          const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
          const voted = voters.has(m.id);
          return (
            <button
              key={m.id}
              onClick={async () => {
                const ok = await requestPin(m, voted ? "Withdraw vote" : "Cast vote", async (pin) => {
                  return await toggleVoteAction(proposal.id, m.id, !voted, pin || null);
                });
                if (ok) router.refresh();
              }}
              disabled={pending || voting}
              className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                voted ? `${color.bg} text-white` : `${color.bgSoft} ${color.text} opacity-50 grayscale`
              }`}
            >
              <div className="text-xl">{memberGlyph(m)}</div>
              <div className="text-[10px]">{m.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileProposeSheet({
  meals,
  weekStart,
  alreadyProposed,
  onClose,
}: {
  meals: Meal[];
  weekStart: string;
  alreadyProposed: Set<number>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<"favorites" | "all">("favorites");

  const favorites = meals.filter((m) => m.is_favorite && !alreadyProposed.has(m.id));
  const others = meals.filter((m) => !m.is_favorite && !alreadyProposed.has(m.id));
  const shown = filter === "favorites"
    ? (favorites.length > 0 ? favorites : others)
    : [...favorites, ...others];

  const propose = (mealId: number) => {
    start(async () => {
      await proposeMealAction(mealId, weekStart);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl p-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold">Propose a meal</div>
          <button onClick={onClose} className="w-10 h-10 rounded-full text-2xl">×</button>
        </div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setFilter("favorites")}
            className={`px-4 py-2 rounded-full text-sm ${filter === "favorites" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            ❤️ Favorites ({favorites.length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-sm ${filter === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            All ({favorites.length + others.length})
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {shown.length === 0 ? (
            <div className="text-center text-zinc-400 py-8 italic">All meals are candidates.</div>
          ) : (
            shown.map((m) => (
              <button
                key={m.id}
                onClick={() => propose(m.id)}
                disabled={pending}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-left"
              >
                <div className="text-3xl">{m.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-1">
                    {m.name}
                    {m.is_favorite && <span className="text-sm">❤️</span>}
                  </div>
                  <div className="text-xs text-zinc-500">{m.ingredients.length} ingredients</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
