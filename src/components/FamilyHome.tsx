"use client";

import Link from "next/link";
import { format, isToday } from "date-fns";
import type { Member, MemberColor, EventRow } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";
import type { Verse } from "@/lib/verses";
import type { Meal, MealSlot } from "@/lib/meals";

const SLOTS: Array<{ key: MealSlot; label: string; icon: string }> = [
  { key: "breakfast", label: "Breakfast", icon: "🥣" },
  { key: "lunch", label: "Lunch", icon: "🥪" },
  { key: "dinner", label: "Dinner", icon: "🍽️" },
];

export function FamilyHome({
  members,
  days,
  eventsByDay,
  eventsByDayMembers,
  todayEvents,
  chorePct,
  pendingCount,
  todayMeals,
  voteCount,
  verse,
  hijriDate,
}: {
  members: Member[];
  days: Date[];
  eventsByDay: Map<string, number>;
  eventsByDayMembers: Map<string, Set<number>>;
  todayEvents: EventRow[];
  chorePct: Map<number, { done: number; total: number }>;
  pendingCount: number;
  todayMeals: Partial<Record<MealSlot, Meal>>;
  voteCount: number;
  verse: Verse;
  hijriDate: string;
}) {
  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="h-full flex bg-zinc-50">
      {/* Left column: verse of the day + week overview */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <section className="mx-6 mt-6 flex items-center justify-between px-2">
          <div className="text-sm text-zinc-500">Today is</div>
          <div className="text-sm font-medium text-emerald-800 tabular-nums">🌙 {hijriDate}</div>
        </section>
        <section className="mx-6 mt-3 rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 border border-emerald-100 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-widest text-emerald-700 font-semibold">
              ✨ Verse of the day
            </div>
            <div className="text-xs text-emerald-700/70 tabular-nums">{verse.surah} · {verse.reference}</div>
          </div>
          <div
            className="mt-4 text-right font-serif leading-loose text-emerald-950"
            style={{ fontSize: "2.2rem", fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif" }}
            dir="rtl"
          >
            {verse.arabic}
          </div>
          <div className="mt-4 text-lg text-emerald-950/90 leading-relaxed italic">
            &ldquo;{verse.translation}&rdquo;
          </div>
        </section>

        <section className="mx-6 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">This week</div>
            <Link href="/week" className="text-sm text-zinc-500 hover:text-zinc-900">See full week →</Link>
          </div>
          <div className="grid grid-cols-7 gap-3">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const count = eventsByDay.get(key) ?? 0;
              const mIds = Array.from(eventsByDayMembers.get(key) ?? []);
              const today = isToday(d);
              return (
                <Link
                  key={key}
                  href={`/week?d=${key}`}
                  className={`rounded-2xl border p-3 flex flex-col items-center transition-all ${
                    today ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className={`text-[10px] uppercase tracking-wide opacity-70`}>{format(d, "EEE")}</div>
                  <div className="text-2xl font-semibold tabular-nums leading-none mt-1">{format(d, "d")}</div>
                  <div className="mt-2 flex items-center gap-0.5 h-3">
                    {mIds.slice(0, 4).map((mid) => {
                      const m = memberById.get(mid);
                      if (!m) return null;
                      const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
                      return <div key={mid} className={`w-2 h-2 rounded-full ${color.dot}`} />;
                    })}
                  </div>
                  <div className={`text-[11px] mt-1 tabular-nums ${today ? "opacity-80" : "text-zinc-400"}`}>
                    {count > 0 ? `${count} event${count > 1 ? "s" : ""}` : " "}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mx-6 mt-6 mb-6">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">Today's schedule</div>
          {todayEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-400 italic">
              Nothing scheduled today. Enjoy the day! 🌿
            </div>
          ) : (
            <ul className="space-y-2">
              {todayEvents.slice(0, 5).map((e) => {
                const m = e.member_id ? memberById.get(e.member_id) : null;
                const color = m ? COLOR_CLASSES[m.color as MemberColor] : COLOR_CLASSES.sky;
                return (
                  <li key={e.id} className={`bg-white rounded-xl border-l-4 ${color.border} border-y border-r border-zinc-200 px-4 py-3 flex items-center gap-3`}>
                    <div className="text-sm text-zinc-500 tabular-nums w-24 shrink-0">
                      {e.all_day ? "All day" : format(new Date(e.start_ts * 1000), "h:mm a")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{e.title}</div>
                      {m && <div className={`text-sm ${color.text}`}>{m.name}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Right column: personal tiles + quick tiles */}
      <div className="w-[520px] shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-y-auto">
        <div className="px-6 py-5 border-b border-zinc-200">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Switch to my view</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {members.map((m) => {
              const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
              const p = chorePct.get(m.id) ?? { done: 0, total: 0 };
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <Link
                  key={m.id}
                  href={`/me/${m.id}`}
                  className={`rounded-2xl border-2 ${color.border} bg-white p-4 flex items-center gap-3 active:bg-zinc-50 shadow-sm`}
                >
                  <div className={`w-14 h-14 rounded-full ${color.bg} flex items-center justify-center text-2xl text-white shrink-0`}>
                    {m.emoji ?? m.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{m.name}</div>
                    <div className="text-xs text-zinc-500">
                      {p.total > 0 ? `${p.done}/${p.total} chores · ${pct}%` : m.role === "child" ? "No chores today" : " "}
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div className={`h-full ${color.bg}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 space-y-3">
          <Link
            href="/chores"
            className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Pending verifications</div>
              <div className="text-3xl font-semibold text-amber-900 mt-1">⏳ {pendingCount}</div>
            </div>
            <div className="text-amber-500 text-2xl">›</div>
          </Link>

          <Link
            href="/meals"
            className="block bg-white border border-zinc-200 rounded-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Today's meals</div>
              <div className="text-zinc-400 text-xl leading-none">›</div>
            </div>
            <ul className="divide-y divide-zinc-100">
              {SLOTS.map((s) => {
                const meal = todayMeals[s.key];
                return (
                  <li key={s.key} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-14 text-center">
                      <div className="text-2xl leading-none">{meal?.icon ?? s.icon}</div>
                      <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">
                        {s.label}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {meal ? (
                        <div className="font-medium truncate">{meal.name}</div>
                      ) : (
                        <div className="text-zinc-400 italic text-sm">Not planned</div>
                      )}
                      {meal?.notes && (
                        <div className="text-xs text-zinc-500 truncate">{meal.notes}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {voteCount > 0 && (
              <div className="px-4 py-2 text-sm text-zinc-600 bg-zinc-50 border-t border-zinc-100">
                🗳️ {voteCount} candidate{voteCount === 1 ? "" : "s"} for next week
              </div>
            )}
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/week"
              className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col items-center"
            >
              <div className="text-3xl">📅</div>
              <div className="text-sm font-medium mt-2">Full week</div>
            </Link>
            <Link
              href="/month"
              className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col items-center"
            >
              <div className="text-3xl">🗓️</div>
              <div className="text-sm font-medium mt-2">Month</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
