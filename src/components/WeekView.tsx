"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, isSameDay, addWeeks, isToday } from "date-fns";
import type { Member, MemberColor, EventRow } from "@/lib/types";
import { COLOR_CLASSES, memberGradient } from "@/lib/types";

// Participant colors for an event (empty → default sky).
function eventColors(e: EventRow, memberById: Map<number, Member>): MemberColor[] {
  const ids = e.member_ids ?? (e.member_id != null ? [e.member_id] : []);
  return ids.map((id) => memberById.get(id)?.color as MemberColor).filter(Boolean);
}
import { QuickAddSheet } from "./QuickAddSheet";
import { EventDetailSheet } from "./EventDetailSheet";

const HOUR_HEIGHT = 56; // px per hour
const DAY_START = 6; // 6am
const DAY_END = 22; // 10pm

export function WeekView({
  days,
  members,
  events,
  anchor,
}: {
  days: Date[];
  members: Member[];
  events: EventRow[];
  anchor: Date;
}) {
  const [quickAdd, setQuickAdd] = useState<{ day: Date; hour: number } | null>(null);
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const prevWeek = format(addWeeks(anchor, -1), "yyyy-MM-dd");
  const nextWeek = format(addWeeks(anchor, 1), "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const allDayByDay = new Map<string, EventRow[]>();
  const timedByDay = new Map<string, EventRow[]>();
  for (const d of days) {
    allDayByDay.set(format(d, "yyyy-MM-dd"), []);
    timedByDay.set(format(d, "yyyy-MM-dd"), []);
  }
  for (const e of events) {
    const start = new Date(e.start_ts * 1000);
    const key = format(start, "yyyy-MM-dd");
    if (!allDayByDay.has(key)) continue;
    if (e.all_day) allDayByDay.get(key)!.push(e);
    else timedByDay.get(key)!.push(e);
  }

  const monthLabel = format(days[0], "MMMM yyyy");

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-zinc-200 bg-white shrink-0">
        <div className="text-xl lg:text-2xl font-semibold">{monthLabel}</div>
        <div className="flex items-center gap-2">
          <Link
            href={`/week?d=${prevWeek}`}
            className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-xl active:bg-zinc-100"
          >
            ‹
          </Link>
          <Link
            href={`/week?d=${todayStr}`}
            className="px-5 h-12 rounded-full border border-zinc-200 flex items-center text-base active:bg-zinc-100"
          >
            Today
          </Link>
          <Link
            href={`/week?d=${nextWeek}`}
            className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-xl active:bg-zinc-100"
          >
            ›
          </Link>
        </div>
      </div>

      {/* On phones the 7-day grid scrolls horizontally (min-w); on the kiosk
          it fills the width (lg:min-w-0). Headers, all-day, and the hourly grid
          share one scroll container so their columns stay aligned. */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="h-full min-w-[720px] lg:min-w-0 flex flex-col">

      {/* Day headers */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-zinc-200 bg-white">
        <div />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className={`py-2 text-center border-l border-zinc-200 ${today ? "bg-zinc-900 text-white" : ""}`}
            >
              <div className="text-xs uppercase tracking-wide opacity-70">{format(d, "EEE")}</div>
              <div className="text-2xl font-semibold tabular-nums">{format(d, "d")}</div>
            </div>
          );
        })}
      </div>

      {/* All-day strip */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-zinc-200 bg-zinc-50 min-h-12">
        <div className="text-xs text-zinc-400 self-center pl-2">all-day</div>
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const ev = allDayByDay.get(key) ?? [];
          return (
            <div key={key} className="border-l border-zinc-200 p-1 flex flex-col gap-1">
              {ev.map((e) => {
                const cols = eventColors(e, memberById);
                const multi = cols.length >= 2;
                const single = COLOR_CLASSES[cols[0] ?? "sky"] ?? COLOR_CLASSES.sky;
                return (
                  <button
                    key={e.id}
                    onClick={() => setOpenEvent(e)}
                    style={multi ? { background: memberGradient(cols) } : undefined}
                    className={`text-left text-sm px-2 py-1 rounded truncate ${multi ? "text-white" : `${single.bgSoft} ${single.text}`}`}
                  >
                    {e.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Hourly grid */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div
          className="grid grid-cols-[64px_repeat(7,1fr)] relative"
          style={{ height: (DAY_END - DAY_START) * HOUR_HEIGHT }}
        >
          {/* hour labels */}
          <div className="relative">
            {Array.from({ length: DAY_END - DAY_START }).map((_, i) => {
              const hour = DAY_START + i;
              const label = hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
              return (
                <div
                  key={hour}
                  className="absolute right-2 text-xs text-zinc-400 tabular-nums"
                  style={{ top: i * HOUR_HEIGHT - 6 }}
                >
                  {i === 0 ? "" : label}
                </div>
              );
            })}
          </div>

          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const ev = timedByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className="relative border-l border-zinc-200"
                style={{ height: (DAY_END - DAY_START) * HOUR_HEIGHT }}
              >
                {/* Hour grid lines + tap targets */}
                {Array.from({ length: DAY_END - DAY_START }).map((_, i) => {
                  const hour = DAY_START + i;
                  return (
                    <button
                      key={hour}
                      onClick={() => setQuickAdd({ day: d, hour })}
                      className="absolute left-0 right-0 border-t border-zinc-100 active:bg-zinc-100"
                      style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    />
                  );
                })}

                {/* Now line */}
                {isSameDay(d, new Date()) && <NowLine />}

                {/* Events */}
                {ev.map((e) => {
                  const start = new Date(e.start_ts * 1000);
                  const end = new Date(e.end_ts * 1000);
                  const startHour = start.getHours() + start.getMinutes() / 60;
                  const endHour = Math.min(DAY_END, end.getHours() + end.getMinutes() / 60);
                  if (startHour >= DAY_END || endHour <= DAY_START) return null;
                  const top = Math.max(0, (startHour - DAY_START) * HOUR_HEIGHT);
                  const height = Math.max(28, (endHour - Math.max(DAY_START, startHour)) * HOUR_HEIGHT);
                  const cols = eventColors(e, memberById);
                  const multi = cols.length >= 2;
                  const single = COLOR_CLASSES[cols[0] ?? "sky"] ?? COLOR_CLASSES.sky;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setOpenEvent(e)}
                      className={`absolute left-1 right-1 rounded-md p-2 text-left overflow-hidden text-sm leading-tight ${
                        multi ? "text-white shadow-sm" : `${single.bgSoft} border-l-4 ${single.border}`
                      }`}
                      style={multi ? { top, height, background: memberGradient(cols) } : { top, height }}
                    >
                      <div className={`font-medium truncate ${multi ? "text-white" : single.text}`}>{e.title}</div>
                      <div className={`text-xs tabular-nums ${multi ? "text-white/80" : "text-zinc-500"}`}>
                        {format(start, "h:mm a")} – {format(end, "h:mm a")}
                      </div>
                      {e.location && <div className={`text-xs truncate ${multi ? "text-white/80" : "text-zinc-500"}`}>📍 {e.location}</div>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
        </div>
      </div>

      {quickAdd && (
        <QuickAddSheet
          day={quickAdd.day}
          hour={quickAdd.hour}
          members={members}
          onClose={() => setQuickAdd(null)}
        />
      )}
      {openEvent && (
        <EventDetailSheet event={openEvent} members={members} onClose={() => setOpenEvent(null)} />
      )}
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < DAY_START || hour > DAY_END) return null;
  const top = (hour - DAY_START) * HOUR_HEIGHT;
  return (
    <div
      className="absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
      style={{ top }}
    >
      <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
    </div>
  );
}
