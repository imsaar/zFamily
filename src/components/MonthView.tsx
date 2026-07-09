"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, isSameMonth, isToday, addMonths } from "date-fns";
import type { Member, MemberColor, EventRow } from "@/lib/types";
import { COLOR_CLASSES, memberGradient } from "@/lib/types";

function eventColors(e: EventRow, memberById: Map<number, Member>): MemberColor[] {
  const ids = e.member_ids ?? (e.member_id != null ? [e.member_id] : []);
  return ids.map((id) => memberById.get(id)?.color as MemberColor).filter(Boolean);
}
import { EventDetailSheet } from "./EventDetailSheet";
import { QuickAddSheet } from "./QuickAddSheet";

export function MonthView({
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
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);
  const [quickAdd, setQuickAdd] = useState<Date | null>(null);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const eventsByDay = new Map<string, EventRow[]>();
  for (const d of days) eventsByDay.set(format(d, "yyyy-MM-dd"), []);
  for (const e of events) {
    const key = format(new Date(e.start_ts * 1000), "yyyy-MM-dd");
    if (eventsByDay.has(key)) eventsByDay.get(key)!.push(e);
  }

  const monthLabel = format(anchor, "MMMM yyyy");
  const prev = format(addMonths(anchor, -1), "yyyy-MM-dd");
  const next = format(addMonths(anchor, 1), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const weekHeaders = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white">
        <div className="text-2xl font-semibold">{monthLabel}</div>
        <div className="flex items-center gap-2">
          <Link href={`/month?d=${prev}`} className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-xl active:bg-zinc-100">‹</Link>
          <Link href={`/month?d=${today}`} className="px-5 h-12 rounded-full border border-zinc-200 flex items-center text-base active:bg-zinc-100">Today</Link>
          <Link href={`/month?d=${next}`} className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-xl active:bg-zinc-100">›</Link>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-zinc-200 bg-white">
        {weekHeaders.map((h, i) => (
          <div key={i} className="py-2 text-center text-xs uppercase tracking-wider text-zinc-400">{h}</div>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-7 bg-white overflow-hidden" style={{ gridAutoRows: "1fr" }}>
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = isSameMonth(d, anchor);
          const today = isToday(d);
          return (
            <div
              key={key}
              onClick={() => setQuickAdd(d)}
              role="button"
              className={`relative border-r border-b border-zinc-100 p-1.5 min-h-0 overflow-hidden flex flex-col cursor-pointer active:bg-zinc-50 ${
                inMonth ? "" : "bg-zinc-50/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`text-sm font-semibold tabular-nums ${
                    today
                      ? "bg-zinc-900 text-white w-7 h-7 rounded-full flex items-center justify-center"
                      : inMonth
                        ? "text-zinc-700"
                        : "text-zinc-300"
                  }`}
                >
                  {format(d, "d")}
                </div>
                {dayEvents.length > 3 && (
                  <div className="text-xs text-zinc-400">+{dayEvents.length - 3}</div>
                )}
              </div>
              <div className="flex-1 mt-1 space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => {
                  const cols = eventColors(e, memberById);
                  const multi = cols.length >= 2;
                  const single = COLOR_CLASSES[cols[0] ?? "sky"] ?? COLOR_CLASSES.sky;
                  return (
                    <button
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); setOpenEvent(e); }}
                      style={multi ? { background: memberGradient(cols) } : undefined}
                      className={`block w-full text-left text-xs px-1.5 py-0.5 rounded truncate ${multi ? "text-white" : `${single.bgSoft} ${single.text}`}`}
                    >
                      {e.all_day ? "" : format(new Date(e.start_ts * 1000), "h:mm") + " "}
                      {e.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {openEvent && (
        <EventDetailSheet event={openEvent} members={members} onClose={() => setOpenEvent(null)} />
      )}
      {quickAdd && (
        <QuickAddSheet day={quickAdd} hour={9} members={members} onClose={() => setQuickAdd(null)} />
      )}
    </div>
  );
}
