"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { format, isToday } from "date-fns";
import type { Member, MemberColor, EventRow } from "@/lib/types";
import { COLOR_CLASSES, displayName, memberGlyph, memberGradient } from "@/lib/types";
import { MemberAvatar } from "./MemberAvatar";
import { commuteLabel } from "./EventDetailSheet";
import type { Verse } from "@/lib/verses";
import type { Meal, MealSlot } from "@/lib/meals";
import type { WeatherSnapshot } from "@/lib/weather";

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
  weather,
  commonChores,
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
  weather: WeatherSnapshot | null;
  commonChores: { done: number; total: number };
}) {
  const memberById = new Map(members.map((m) => [m.id, m]));
  const [showContext, setShowContext] = useState(false);

  // tanzil.net deep-links via a hash route (#trans/<id>/<sura>:<aya>) — the
  // path form returns "File not found". For a range like "1:1-3" open at the
  // first ayah, then the reader can scroll for context.
  const ayahStart = verse.reference.split("-")[0].trim();
  const tanzilUrl = `https://tanzil.net/#trans/en.qarai/${ayahStart}`;

  // Long verses are clamped on the card (CSS ellipsis); detect when either
  // the Arabic or the translation actually overflows so we can offer a
  // "read the full ayah" link into the tanzil modal.
  const arabicRef = useRef<HTMLDivElement>(null);
  const transRef = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const clipped = (el: HTMLElement | null) => !!el && el.scrollHeight - el.clientHeight > 2;
    const check = () => setTruncated(clipped(arabicRef.current) || clipped(transRef.current));
    check();
    const ro = new ResizeObserver(check);
    if (arabicRef.current) ro.observe(arabicRef.current);
    if (transRef.current) ro.observe(transRef.current);
    window.addEventListener("resize", check);
    // Arabic webfonts load async and change the wrapped height — recheck.
    if (typeof document !== "undefined" && "fonts" in document) document.fonts.ready.then(check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [verse.arabic, verse.translation]);

  return (
    <>
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
            <button
              onClick={() => setShowContext(true)}
              className="text-xs text-emerald-700/80 tabular-nums underline decoration-dotted underline-offset-2 hover:text-emerald-900 active:text-emerald-900"
            >
              {verse.surah} · {verse.reference} 📖
            </button>
          </div>
          <div
            ref={arabicRef}
            className="mt-4 text-right font-serif leading-loose text-emerald-950 line-clamp-4"
            style={{ fontSize: "2.2rem", fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif" }}
            dir="rtl"
          >
            {verse.arabic}
          </div>
          <div ref={transRef} className="mt-4 text-lg text-emerald-950/90 leading-relaxed italic line-clamp-3">
            &ldquo;{verse.translation}&rdquo;
          </div>
          {truncated && (
            <button
              onClick={() => setShowContext(true)}
              className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 active:text-emerald-900"
            >
              … Read the full ayah 📖
            </button>
          )}
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
                const ids = e.member_ids ?? (e.member_id != null ? [e.member_id] : []);
                const parts = ids.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
                const cols = parts.map((m) => m.color as MemberColor);
                return (
                  <li key={e.id} className="bg-white rounded-xl border border-zinc-200 pr-4 py-3 pl-3 flex items-center gap-3 overflow-hidden">
                    <div className="w-1.5 self-stretch -my-3 rounded-full shrink-0" style={{ background: memberGradient(cols) }} />
                    <div className="text-sm text-zinc-500 tabular-nums w-28 shrink-0 leading-tight">
                      {e.all_day ? (
                        "All day"
                      ) : (
                        <>
                          <div>{format(new Date(e.start_ts * 1000), "h:mm a")}</div>
                          <div className="text-zinc-400">– {format(new Date(e.end_ts * 1000), "h:mm a")}</div>
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{e.title}</div>
                      {parts.length > 0 && (
                        <div className="text-sm text-zinc-500 truncate">
                          {parts.map((m) => `${memberGlyph(m)} ${displayName(m)}`).join(" · ")}
                        </div>
                      )}
                      {(e.location || e.commute_seconds != null) && (
                        <div className="text-xs text-zinc-400 truncate">
                          {e.location && <span>📍 {e.location}</span>}
                          {e.commute_seconds != null && (
                            <span>{e.location ? " · " : ""}{e.commute_mode === "bus" ? "🚌" : "🚗"} {commuteLabel(e.commute_seconds)}</span>
                          )}
                        </div>
                      )}
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
            {members.filter((m) => m.role === "child").map((m) => {
              const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
              const p = chorePct.get(m.id) ?? { done: 0, total: 0 };
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <Link
                  key={m.id}
                  href={`/me/${m.id}`}
                  className={`rounded-2xl border-2 ${color.border} bg-white p-4 flex items-center gap-3 active:bg-zinc-50 shadow-sm`}
                >
                  <MemberAvatar member={m} className="w-14 h-14 rounded-full shrink-0" textClass="text-2xl" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{displayName(m)}</div>
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
            {commonChores.total > 0 && (
              <Link
                href="/chores"
                className="rounded-2xl border-2 border-zinc-200 bg-white p-4 flex items-center gap-3 active:bg-zinc-50 shadow-sm"
              >
                <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center text-2xl shrink-0">🧹</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">Common chores</div>
                  <div className="text-xs text-zinc-500">{commonChores.done}/{commonChores.total} done today</div>
                  <div className="mt-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-zinc-900"
                      style={{ width: `${commonChores.total ? Math.round((commonChores.done / commonChores.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {weather && (weather.hourly.length > 0 || weather.forecast.length > 0) && (
          <div className="px-6 py-5 border-b border-zinc-200">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Weather</div>
              <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                <span className="text-lg leading-none">{weather.conditionIcon}</span>
                <span className="tabular-nums">{weather.currentTempF}°</span>
                <span className="truncate max-w-[140px]">{weather.currentCondition}</span>
              </div>
            </div>

            {weather.hourly.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                {weather.hourly.map((h) => (
                  <div key={h.time} className="flex flex-col items-center gap-1 shrink-0 w-12">
                    <div className="text-[11px] text-zinc-500 tabular-nums">{format(new Date(h.time), "h a")}</div>
                    <div className="text-2xl leading-none">{h.icon}</div>
                    <div className="text-sm font-medium tabular-nums">{h.tempF}°</div>
                  </div>
                ))}
              </div>
            )}

            {weather.forecast.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {weather.forecast.slice(0, 7).map((d, i) => (
                  <div key={d.date} className="flex items-center gap-3 text-sm">
                    <div className="w-12 text-zinc-500">{i === 0 ? "Today" : format(new Date(`${d.date}T12:00:00`), "EEE")}</div>
                    <div className="text-xl leading-none w-7 text-center">{d.icon}</div>
                    <div className="text-zinc-400 truncate flex-1">{d.condition}</div>
                    <div className="tabular-nums shrink-0">
                      <span className="font-medium">{d.highF}°</span> <span className="text-zinc-400">{d.lowF}°</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

    {showContext && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 fade-in" onClick={() => setShowContext(false)} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl mx-6 h-[85vh] flex flex-col overflow-hidden fade-in">
          <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between shrink-0">
            <div>
              <div className="text-xs uppercase tracking-widest text-emerald-700 font-semibold">
                Ali Quli Qarai translation
              </div>
              <div className="text-lg font-semibold">{verse.surah} · {verse.reference}</div>
            </div>
            <button
              onClick={() => setShowContext(false)}
              aria-label="Close"
              className="w-11 h-11 rounded-full text-3xl text-zinc-500 hover:bg-zinc-100 flex items-center justify-center"
            >
              ×
            </button>
          </div>
          <iframe
            src={tanzilUrl}
            title={`Quran ${verse.reference} — Ali Quli Qarai translation on tanzil.net`}
            className="flex-1 w-full border-0"
          />
        </div>
      </div>
    )}
    </>
  );
}
