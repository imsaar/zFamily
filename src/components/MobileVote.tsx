"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Meal, MealSlot, ProposalWithVotes } from "@/lib/meals";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES, memberGlyph } from "@/lib/types";
import { proposeMealAction, removeProposalAction, toggleVoteAction } from "@/app/actions";
import { useRequestPin } from "./PinPad";

const SLOTS: Array<{ key: MealSlot; label: string; icon: string }> = [
  { key: "breakfast", label: "Breakfast", icon: "🥣" },
  { key: "lunch", label: "Lunch", icon: "🥪" },
  { key: "dinner", label: "Dinner", icon: "🍽️" },
];

export function MobileVote({
  proposals,
  meals,
  members,
}: {
  proposals: ProposalWithVotes[];
  meals: Meal[];
  members: Member[];
}) {
  const [adding, setAdding] = useState(false);
  const memberById = new Map(members.map((m) => [m.id, m]));

  const shared = [...proposals]
    .filter((p) => p.member_id == null)
    .sort((a, b) => (b.votes.length - a.votes.length) || (a.created_at - b.created_at));
  const personal = proposals.filter((p) => p.member_id != null);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 p-4 space-y-3 overflow-y-auto">
        <p className="text-sm text-zinc-500">
          Future meal ideas — lunch &amp; dinner are shared, so vote below. Breakfast is each person&apos;s own pick. A
          parent places the winners onto the plan.
        </p>

        <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Shared · lunch &amp; dinner</div>
        {shared.length === 0 && (
          <div className="text-center text-zinc-400 py-4 italic">No shared ideas yet.</div>
        )}
        {shared.map((p, i) => (
          <MobileProposalCard key={p.id} proposal={p} rank={i} members={members} />
        ))}

        {personal.length > 0 && (
          <>
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold pt-2">Personal breakfasts</div>
            {personal.map((p) => {
              const who = p.member_id != null ? memberById.get(p.member_id) : null;
              return (
                <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-3 flex items-center gap-3">
                  <div className="text-3xl">{p.meal.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.meal.name}</div>
                    <div className="text-xs text-zinc-500">{who ? `${who.name}'s pick` : "personal"}</div>
                  </div>
                  <RemoveButton id={p.id} />
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="p-4 border-t border-zinc-200 bg-white shrink-0">
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-700 font-medium"
        >
          + Propose a dish
        </button>
      </div>

      {adding && (
        <MobileProposeSheet meals={meals} members={members} proposals={proposals} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

function RemoveButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await removeProposalAction(id); router.refresh(); })}
      disabled={pending}
      aria-label="Remove idea"
      className="w-9 h-9 text-zinc-300 text-xl"
    >
      ×
    </button>
  );
}

function MobileProposalCard({
  proposal,
  rank,
  members,
}: {
  proposal: ProposalWithVotes;
  rank: number;
  members: Member[];
}) {
  const router = useRouter();
  const [voting] = useTransition();
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
        <RemoveButton id={proposal.id} />
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
              disabled={voting}
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
  members,
  proposals,
  onClose,
}: {
  meals: Meal[];
  members: Member[];
  proposals: ProposalWithVotes[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [who, setWho] = useState<number | null>(members[0]?.id ?? null);
  const [filter, setFilter] = useState<"favorites" | "all">("favorites");

  const personal = slot === "breakfast";
  const memberId = personal ? who : null;

  const already = new Set(
    proposals
      .filter((p) => p.slot_type === slot && (p.member_id ?? null) === (memberId ?? null))
      .map((p) => p.meal_id)
  );
  const eligible = meals.filter((m) => m.slots.includes(slot) && !already.has(m.id));
  const favorites = eligible.filter((m) => m.is_favorite);
  const others = eligible.filter((m) => !m.is_favorite);
  const shown = filter === "favorites" ? (favorites.length > 0 ? favorites : others) : [...favorites, ...others];

  const propose = (mealId: number) => {
    if (personal && memberId == null) return;
    start(async () => {
      await proposeMealAction(mealId, slot, memberId);
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
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Propose a dish</div>
          <button onClick={onClose} className="w-10 h-10 rounded-full text-2xl">×</button>
        </div>

        <div className="flex gap-2 mb-2">
          {SLOTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSlot(s.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm ${
                slot === s.key ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 text-zinc-700"
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {personal && (
          <div className="flex flex-wrap gap-2 mb-2">
            {members.map((m) => {
              const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
              const sel = who === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setWho(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm ${
                    sel ? `${color.bg} ${color.border} text-white` : "border-zinc-200"
                  }`}
                >
                  <span>{memberGlyph(m)}</span>
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>
        )}

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
            <div className="text-center text-zinc-400 py-8 italic">No dishes to propose.</div>
          ) : (
            shown.map((m) => (
              <button
                key={m.id}
                onClick={() => propose(m.id)}
                disabled={pending || (personal && memberId == null)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-left disabled:opacity-40"
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
