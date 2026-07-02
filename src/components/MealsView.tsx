"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, addWeeks, isToday } from "date-fns";
import type { Meal, MealSlot, PlanEntry, ShoppingItem, Ingredient, ProposalWithVotes } from "@/lib/meals";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";
import { Sheet } from "./Sheet";
import {
  planAndShopAction,
  setPlanSlotAction,
  addShoppingItemAction,
  toggleShoppingItemAction,
  deleteShoppingItemAction,
  clearCheckedShoppingAction,
  createMealAction,
  updateMealAction,
  deleteMealAction,
  toggleFavoriteAction,
  proposeMealAction,
  removeProposalAction,
  toggleVoteAction,
  applyWinnersAction,
} from "@/app/actions";
import { useRequestPin } from "./PinPad";

const SLOTS: Array<{ key: MealSlot; label: string; icon: string }> = [
  { key: "breakfast", label: "Breakfast", icon: "🥣" },
  { key: "lunch", label: "Lunch", icon: "🥪" },
  { key: "dinner", label: "Dinner", icon: "🍽️" },
];

export function MealsView({
  days,
  anchor,
  meals,
  plan,
  shopping,
  members,
  nextWeek,
  proposals,
}: {
  days: Date[];
  anchor: Date;
  meals: Meal[];
  plan: PlanEntry[];
  shopping: ShoppingItem[];
  members: Member[];
  nextWeek: string;
  proposals: ProposalWithVotes[];
}) {
  const [picker, setPicker] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [library, setLibrary] = useState(false);
  const [voting, setVoting] = useState(false);

  const mealById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);
  const planByKey = useMemo(() => {
    const m = new Map<string, Meal>();
    for (const p of plan) {
      const meal = mealById.get(p.meal_id);
      if (meal) m.set(`${p.meal_date}:${p.slot}`, meal);
    }
    return m;
  }, [plan, mealById]);

  const monthLabel = format(days[0], "MMMM d") + " – " + format(days[6], "d, yyyy");
  const prev = format(addWeeks(anchor, -1), "yyyy-MM-dd");
  const next = format(addWeeks(anchor, 1), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="h-full flex">
      {/* Weekly meal plan */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white">
          <div className="text-2xl font-semibold">Meal plan · {monthLabel}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoting(true)}
              className="px-4 h-12 rounded-full border border-zinc-200 flex items-center gap-2 text-base active:bg-zinc-100 relative"
            >
              🗳️ Vote next week
              {proposals.length > 0 && (
                <span className="ml-1 min-w-6 h-6 px-1.5 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center tabular-nums">
                  {proposals.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setLibrary(true)}
              className="px-4 h-12 rounded-full border border-zinc-200 flex items-center text-base active:bg-zinc-100"
            >
              📖 Library
            </button>
            <Link href={`/meals?d=${prev}`} className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-xl active:bg-zinc-100">‹</Link>
            <Link href={`/meals?d=${today}`} className="px-5 h-12 rounded-full border border-zinc-200 flex items-center text-base active:bg-zinc-100">Today</Link>
            <Link href={`/meals?d=${next}`} className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-xl active:bg-zinc-100">›</Link>
          </div>
        </div>

        {/* Day columns × 3 slots grid */}
        <div className="flex-1 min-h-0 grid grid-cols-7 bg-white overflow-hidden">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const isToday_ = isToday(d);
            return (
              <div key={key} className="border-l border-zinc-100 first:border-l-0 flex flex-col">
                <div className={`py-2 text-center border-b border-zinc-200 ${isToday_ ? "bg-zinc-900 text-white" : "bg-zinc-50"}`}>
                  <div className="text-xs uppercase tracking-wide opacity-70">{format(d, "EEE")}</div>
                  <div className="text-xl font-semibold tabular-nums">{format(d, "d")}</div>
                </div>
                <div className="flex-1 flex flex-col divide-y divide-zinc-100">
                  {SLOTS.map((s) => {
                    const meal = planByKey.get(`${key}:${s.key}`);
                    return (
                      <button
                        key={s.key}
                        onClick={() => setPicker({ date: key, slot: s.key })}
                        className="flex-1 min-h-0 p-2 text-left flex flex-col justify-center hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
                      >
                        <div className="text-[10px] uppercase tracking-wide text-zinc-400">{s.label}</div>
                        {meal ? (
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="text-lg">{meal.icon}</span>
                            <span className="text-sm font-medium truncate">{meal.name}</span>
                          </div>
                        ) : (
                          <div className="mt-1 text-zinc-300 text-xs">+ Add</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shopping list sidebar */}
      <ShoppingList items={shopping} />

      {picker && (
        <MealPicker
          date={picker.date}
          slot={picker.slot}
          meals={meals}
          current={planByKey.get(`${picker.date}:${picker.slot}`)}
          onClose={() => setPicker(null)}
        />
      )}
      {library && <MealLibrary meals={meals} onClose={() => setLibrary(false)} />}
      {voting && (
        <VotingSheet
          weekStart={nextWeek}
          proposals={proposals}
          meals={meals}
          members={members}
          onClose={() => setVoting(false)}
        />
      )}
    </div>
  );
}

function ShoppingList({ items }: { items: ShoppingItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("");

  const active = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  const add = () => {
    if (!newItem.trim()) return;
    start(async () => {
      await addShoppingItemAction({ name: newItem, quantity: newQty || null });
      router.refresh();
      setNewItem("");
      setNewQty("");
    });
  };

  return (
    <aside className="w-[400px] border-l border-zinc-200 bg-white flex flex-col overflow-hidden shrink-0">
      <div className="px-6 py-4 border-b border-zinc-200">
        <div className="text-sm uppercase tracking-wider text-zinc-400">Shopping list</div>
        <div className="text-2xl font-semibold">🛒 {active.length} to buy</div>
      </div>
      <div className="px-4 py-3 border-b border-zinc-100 space-y-2">
        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add item…"
            className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-base"
          />
          <input
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Qty"
            className="w-20 px-3 py-2 border border-zinc-300 rounded-lg text-base"
          />
          <button
            onClick={add}
            disabled={pending || !newItem.trim()}
            className="w-12 h-11 rounded-lg bg-zinc-900 text-white text-xl disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {active.length === 0 && done.length === 0 && (
          <div className="text-sm text-zinc-400 italic text-center py-8">List is empty.</div>
        )}
        <ul className="space-y-1">
          {active.map((i) => (
            <ShoppingRow key={i.id} item={i} />
          ))}
        </ul>
        {done.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-4 mb-1 px-1">
              <div className="text-xs uppercase tracking-wide text-zinc-400">Bought ({done.length})</div>
              <button
                onClick={() =>
                  start(async () => {
                    await clearCheckedShoppingAction();
                    router.refresh();
                  })
                }
                className="text-xs text-zinc-500"
              >
                Clear
              </button>
            </div>
            <ul className="space-y-1">
              {done.map((i) => (
                <ShoppingRow key={i.id} item={i} />
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

function ShoppingRow({ item }: { item: ShoppingItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <li>
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            start(async () => {
              await toggleShoppingItemAction(item.id);
              router.refresh();
            })
          }
          disabled={pending}
          className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg active:bg-zinc-100 text-left ${
            item.checked ? "opacity-50" : ""
          }`}
        >
          <div
            className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center shrink-0 ${
              item.checked ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-400 bg-white"
            }`}
          >
            {item.checked ? (
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M4 10l4 4 8-8" strokeLinecap="square" strokeLinejoin="miter" />
              </svg>
            ) : null}
          </div>
          <span className={`flex-1 text-base ${item.checked ? "line-through" : ""}`}>{item.name}</span>
          {item.quantity && <span className="text-sm text-zinc-500">{item.quantity}</span>}
        </button>
        <button
          onClick={() =>
            start(async () => {
              await deleteShoppingItemAction(item.id);
              router.refresh();
            })
          }
          disabled={pending}
          className="w-8 h-8 text-zinc-300 hover:text-red-500 text-lg"
        >
          ×
        </button>
      </div>
    </li>
  );
}

function MealPicker({
  date,
  slot,
  meals,
  current,
  onClose,
}: {
  date: string;
  slot: MealSlot;
  meals: Meal[];
  current: Meal | undefined;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addToShop, setAddToShop] = useState(true);

  const pick = (mealId: number) => {
    start(async () => {
      if (addToShop) await planAndShopAction(date, slot, mealId);
      else await setPlanSlotAction(date, slot, mealId);
      router.refresh();
      onClose();
    });
  };
  const clear = () => {
    start(async () => {
      await setPlanSlotAction(date, slot, null);
      router.refresh();
      onClose();
    });
  };

  const label = SLOTS.find((s) => s.key === slot)?.label ?? slot;
  const dateLabel = format(new Date(`${date}T12:00:00`), "EEE, MMM d");

  const favorites = meals.filter((m) => m.is_favorite);
  const others = meals.filter((m) => !m.is_favorite);

  return (
    <Sheet open onClose={onClose} title={`${dateLabel} · ${label}`} width="max-w-2xl">
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={addToShop}
            onChange={(e) => setAddToShop(e.target.checked)}
            className="w-5 h-5"
          />
          Add ingredients to shopping list
        </label>

        {favorites.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">❤️ Favorites</div>
            <div className="grid grid-cols-2 gap-3">
              {favorites.map((m) => (
                <MealPickerCard key={m.id} meal={m} selected={current?.id === m.id} disabled={pending} onPick={() => pick(m.id)} />
              ))}
            </div>
          </div>
        )}
        {others.length > 0 && (
          <div>
            {favorites.length > 0 && <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">All meals</div>}
            <div className="grid grid-cols-2 gap-3">
              {others.map((m) => (
                <MealPickerCard key={m.id} meal={m} selected={current?.id === m.id} disabled={pending} onPick={() => pick(m.id)} />
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {current && (
            <button onClick={clear} disabled={pending} className="px-5 py-3 rounded-xl border border-red-300 text-red-600">
              Remove
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-300">
            Cancel
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function MealPickerCard({
  meal,
  selected,
  disabled,
  onPick,
}: {
  meal: Meal;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left ${
        selected ? "bg-zinc-100 border-zinc-900" : "border-zinc-200 hover:bg-zinc-50"
      }`}
    >
      <div className="text-3xl">{meal.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-1.5">
          {meal.name}
          {meal.is_favorite ? <span className="text-sm">❤️</span> : null}
        </div>
        <div className="text-xs text-zinc-500">{meal.ingredients.length} ingredients</div>
      </div>
    </button>
  );
}

function MealLibrary({ meals, onClose }: { meals: Meal[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Meal | "new" | null>(null);
  const [filter, setFilter] = useState<"all" | "favorites">("all");

  const favCount = meals.filter((m) => m.is_favorite).length;
  const shown = filter === "favorites" ? meals.filter((m) => m.is_favorite) : meals;

  return (
    <Sheet open onClose={onClose} title="Meal library" width="max-w-3xl">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-sm ${filter === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            All ({meals.length})
          </button>
          <button
            onClick={() => setFilter("favorites")}
            className={`px-4 py-2 rounded-full text-sm ${filter === "favorites" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            ❤️ Favorites ({favCount})
          </button>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="px-4 py-2 rounded-xl bg-zinc-900 text-white"
        >
          + New meal
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((m) => (
          <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50">
            <div className="text-3xl">{m.icon}</div>
            <button onClick={() => setEditing(m)} className="min-w-0 flex-1 text-left">
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-zinc-500 truncate">
                {m.ingredients.map((i) => i.name).join(", ")}
              </div>
            </button>
            <button
              onClick={() =>
                start(async () => {
                  await toggleFavoriteAction(m.id);
                  router.refresh();
                })
              }
              disabled={pending}
              aria-label={m.is_favorite ? "Remove from favorites" : "Add to favorites"}
              className="w-10 h-10 rounded-full flex items-center justify-center text-2xl leading-none active:bg-zinc-100"
            >
              {m.is_favorite ? "❤️" : "🤍"}
            </button>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="col-span-2 text-center py-8 text-zinc-400 italic">No favorites yet — tap 🤍 on any meal.</div>
        )}
      </div>
      {editing && (
        <MealEditor
          meal={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Sheet>
  );
}

function VotingSheet({
  weekStart,
  proposals,
  meals,
  members,
  onClose,
}: {
  weekStart: string;
  proposals: ProposalWithVotes[];
  meals: Meal[];
  members: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const ranked = [...proposals].sort((a, b) => {
    if (b.votes.length !== a.votes.length) return b.votes.length - a.votes.length;
    return a.created_at - b.created_at;
  });

  const proposedMealIds = new Set(proposals.map((p) => p.meal_id));
  const weekLabel = `${format(new Date(`${weekStart}T12:00:00`), "MMM d")} – ${format(addWeeks(new Date(`${weekStart}T12:00:00`), 1), "MMM d")}`;

  const apply = () => {
    start(async () => {
      const r = await applyWinnersAction(weekStart, false);
      alert(`Filled ${r.filled} dinner slot${r.filled === 1 ? "" : "s"} for next week.`);
      router.refresh();
      onClose();
    });
  };

  return (
    <Sheet open onClose={onClose} title={`Vote for next week · ${weekLabel}`} width="max-w-3xl">
      <div className="space-y-4">
        {ranked.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 italic">
            No candidates yet — tap "+ Propose a meal" below to start.
          </div>
        ) : (
          <ul className="space-y-2">
            {ranked.map((p, i) => (
              <ProposalRow
                key={p.id}
                proposal={p}
                rank={i}
                members={members}
                memberById={memberById}
                onRemove={() =>
                  start(async () => {
                    await removeProposalAction(p.id);
                    router.refresh();
                  })
                }
                pending={pending}
              />
            ))}
          </ul>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setAdding(true)}
            className="flex-1 py-3 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-700 font-medium active:bg-zinc-50"
          >
            + Propose a meal
          </button>
          {ranked.length > 0 && (
            <button
              onClick={() => setConfirmApply(true)}
              disabled={pending}
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium active:bg-emerald-700 disabled:opacity-40"
            >
              🍽️ Apply top {Math.min(ranked.length, 7)} to plan
            </button>
          )}
        </div>
      </div>

      {adding && (
        <ProposeSheet
          meals={meals}
          weekStart={weekStart}
          alreadyProposed={proposedMealIds}
          onClose={() => setAdding(false)}
        />
      )}
      {confirmApply && (
        <Sheet open onClose={() => setConfirmApply(false)} title="Apply winners?">
          <div className="space-y-4">
            <p className="text-zinc-700">
              This will fill the dinner slots for next week ({weekLabel}) with the top-voted meals.
              Slots that already have a meal planned will be skipped.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmApply(false)} className="flex-1 py-3 rounded-xl border border-zinc-300">
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmApply(false);
                  apply();
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}

function ProposalRow({
  proposal,
  rank,
  members,
  memberById,
  onRemove,
  pending,
}: {
  proposal: ProposalWithVotes;
  rank: number;
  members: Member[];
  memberById: Map<number, Member>;
  onRemove: () => void;
  pending: boolean;
}) {
  const router = useRouter();
  const [voting, startVote] = useTransition();
  const requestPin = useRequestPin();
  const voters = new Set(proposal.votes);
  const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : null;

  return (
    <li className="flex items-center gap-4 p-3 rounded-2xl border border-zinc-200 bg-white">
      <div className="text-3xl">{proposal.meal.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {medal && <div className="text-lg">{medal}</div>}
          <div className="font-semibold truncate">{proposal.meal.name}</div>
          {proposal.meal.is_favorite && <span className="text-sm">❤️</span>}
        </div>
        <div className="text-xs text-zinc-500">
          {proposal.votes.length} vote{proposal.votes.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {members.map((m) => {
          const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
          const voted = voters.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() =>
                startVote(async () => {
                  const ok = await requestPin(m, voted ? "Withdraw vote" : "Cast vote", async (pin) => {
                    return await toggleVoteAction(proposal.id, m.id, !voted, pin || null);
                  });
                  if (ok) router.refresh();
                })
              }
              disabled={voting || pending}
              aria-label={`${voted ? "Withdraw" : "Cast"} vote for ${m.name}`}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-xl transition-all ${
                voted
                  ? `${color.bg} text-white shadow-sm scale-105`
                  : `${color.bgSoft} ${color.text} opacity-50 grayscale`
              }`}
            >
              {m.emoji ?? m.name[0]}
            </button>
          );
        })}
      </div>
      <button
        onClick={onRemove}
        disabled={pending}
        className="w-9 h-9 text-zinc-300 hover:text-red-500 text-xl"
        aria-label="Remove candidate"
      >
        ×
      </button>
    </li>
  );
}

function ProposeSheet({
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
    <Sheet open onClose={onClose} title="Propose a meal" width="max-w-2xl">
      <div className="space-y-4">
        <div className="flex gap-2">
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
            All meals ({favorites.length + others.length})
          </button>
        </div>
        {shown.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 italic">All meals are already candidates.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shown.map((m) => (
              <button
                key={m.id}
                onClick={() => propose(m.id)}
                disabled={pending}
                className="flex items-center gap-3 p-3 rounded-xl border-2 border-zinc-200 hover:bg-zinc-50 text-left"
              >
                <div className="text-3xl">{m.icon}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-1">
                    {m.name}
                    {m.is_favorite && <span className="text-sm">❤️</span>}
                  </div>
                  <div className="text-xs text-zinc-500">{m.ingredients.length} ingredients</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function MealEditor({ meal, onClose }: { meal: Meal | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(meal?.name ?? "");
  const [icon, setIcon] = useState(meal?.icon ?? "🍽️");
  const [notes, setNotes] = useState(meal?.notes ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(meal?.ingredients ?? [{ name: "", quantity: "" }]);

  const save = () => {
    if (!name.trim()) return;
    const cleaned = ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), quantity: i.quantity?.trim() || undefined }));
    start(async () => {
      const data = { name: name.trim(), icon: icon || null, notes: notes || null, ingredients: cleaned };
      if (meal) await updateMealAction(meal.id, data);
      else await createMealAction(data);
      router.refresh();
      onClose();
    });
  };

  const del = () => {
    if (!meal || !confirm(`Delete "${meal.name}"?`)) return;
    start(async () => {
      await deleteMealAction(meal.id);
      router.refresh();
      onClose();
    });
  };

  return (
    <Sheet open onClose={onClose} title={meal ? "Edit meal" : "New meal"} width="max-w-xl">
      <div className="space-y-4">
        <div className="flex gap-3">
          <input value={icon ?? ""} onChange={(e) => setIcon(e.target.value)} maxLength={4} className="w-20 px-4 py-3 text-center text-2xl border border-zinc-300 rounded-xl" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name" className="flex-1 px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-500">Ingredients</label>
          <div className="mt-2 space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={ing.name}
                  onChange={(e) => {
                    const next = [...ingredients];
                    next[i] = { ...next[i], name: e.target.value };
                    setIngredients(next);
                  }}
                  placeholder="Ingredient"
                  className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg"
                />
                <input
                  value={ing.quantity ?? ""}
                  onChange={(e) => {
                    const next = [...ingredients];
                    next[i] = { ...next[i], quantity: e.target.value };
                    setIngredients(next);
                  }}
                  placeholder="Qty"
                  className="w-28 px-3 py-2 border border-zinc-300 rounded-lg"
                />
                <button
                  onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}
                  className="w-10 text-zinc-400"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => setIngredients([...ingredients, { name: "", quantity: "" }])}
              className="text-sm text-zinc-500"
            >
              + Add ingredient
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-500">Notes (optional)</label>
          <textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full px-4 py-3 border border-zinc-300 rounded-xl resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          {meal && (
            <button onClick={del} disabled={pending} className="px-5 py-3 rounded-xl border border-red-300 text-red-600">
              Delete
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-300">Cancel</button>
          <button
            onClick={save}
            disabled={pending || !name.trim()}
            className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
