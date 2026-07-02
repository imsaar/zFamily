"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addShoppingItemAction,
  toggleShoppingItemAction,
  deleteShoppingItemAction,
  clearCheckedShoppingAction,
} from "@/app/actions";
import type { ShoppingItem } from "@/lib/meals";

export function MobileShoppingList({ items }: { items: ShoppingItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");

  const active = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  const add = () => {
    if (!name.trim()) return;
    start(async () => {
      await addShoppingItemAction({ name, quantity: qty || null });
      router.refresh();
      setName("");
      setQty("");
    });
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-zinc-200 bg-white flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add item…"
          className="flex-1 px-4 py-3 border border-zinc-300 rounded-xl text-base"
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Qty"
          className="w-20 px-3 py-3 border border-zinc-300 rounded-xl text-base"
        />
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="w-14 rounded-xl bg-zinc-900 text-white text-2xl disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {items.length === 0 && (
          <div className="text-center text-zinc-400 py-16">List is empty</div>
        )}
        {active.map((i) => (
          <Row key={i.id} item={i} />
        ))}
        {done.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-4 mb-2 px-1">
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
            {done.map((i) => (
              <Row key={i.id} item={i} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ item }: { item: ShoppingItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() =>
          start(async () => {
            await toggleShoppingItemAction(item.id);
            router.refresh();
          })
        }
        disabled={pending}
        className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-zinc-200 text-left ${
          item.checked ? "opacity-50" : ""
        }`}
      >
        <div
          className={`w-7 h-7 rounded-md border-2 flex items-center justify-center shrink-0 ${
            item.checked ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-300 bg-white"
          }`}
        >
          {item.checked && (
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
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
        className="w-10 h-10 rounded-full text-zinc-400 text-xl"
      >
        ×
      </button>
    </div>
  );
}
