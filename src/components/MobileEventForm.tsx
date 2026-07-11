"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createEventAction } from "@/app/actions";
import { AddressField } from "./AddressField";
import { TransportModePicker, type TransportMode } from "./TransportMode";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES, memberGlyph } from "@/lib/types";

export function MobileEventForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [transport, setTransport] = useState<TransportMode>("car");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(Date.now() + 3600_000), "HH:00"));
  const [duration, setDuration] = useState(60);
  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekdays" | "weekly" | "monthly">("none");
  const [interval, setInterval] = useState(1);

  const submit = () => {
    if (!title.trim()) return;
    start(async () => {
      const startDate = new Date(`${date}T${allDay ? "00:00" : time}:00`);
      const endDate = new Date(startDate.getTime() + (allDay ? 24 * 3600_000 : duration * 60_000));
      await createEventAction({
        member_ids: Array.from(memberIds),
        title: title.trim(),
        start_ts: Math.floor(startDate.getTime() / 1000),
        end_ts: Math.floor(endDate.getTime() / 1000),
        all_day: allDay,
        location: location.trim() || undefined,
        address: address.trim() || null,
        commute_mode: transport,
        recurrence,
        interval,
      });
      router.push("/m");
    });
  };

  return (
    <div className="p-5 space-y-5">
      <div>
        <label className="text-sm font-medium text-zinc-500">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Soccer practice"
          className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl bg-white"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-500">Who</label>
          <div className="flex gap-3 text-sm">
            <button onClick={() => setMemberIds(new Set(members.map((m) => m.id)))} className="text-zinc-600">All</button>
            <button onClick={() => setMemberIds(new Set())} className="text-zinc-600">Clear</button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {members.map((m) => {
            const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
            const selected = memberIds.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => setMemberIds((prev) => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${
                  selected ? `${color.bg} ${color.border} text-white` : "border-zinc-200 bg-white text-zinc-700"
                }`}
              >
                <span>{memberGlyph(m)}</span>
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-500">Location</label>
        <div className="mt-1">
          <AddressField name={location} address={address} onNameChange={setLocation} onAddressChange={setAddress} />
          {(location.trim() || address.trim()) && (
            <TransportModePicker value={transport} onChange={setTransport} />
          )}
        </div>
      </div>

      <label className="flex items-center gap-3 text-base">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="w-6 h-6" />
        All-day event
      </label>

      <div>
        <label className="text-sm font-medium text-zinc-500">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl bg-white"
        />
      </div>

      {!allDay && (
        <>
          <div>
            <label className="text-sm font-medium text-zinc-500">Start time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-500">Duration</label>
            <div className="mt-2 flex gap-2">
              {[30, 60, 90, 120, 180].map((min) => (
                <button
                  key={min}
                  onClick={() => setDuration(min)}
                  className={`px-4 py-2 rounded-full border-2 ${
                    duration === min ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  {min < 60 ? `${min}m` : `${min / 60}h`}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <label className="text-sm font-medium text-zinc-500">Repeats</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {([
            ["none", "Once"],
            ["daily", "Every day"],
            ["weekdays", "Weekdays"],
            ["weekly", "Weekly"],
            ["monthly", "Monthly"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRecurrence(key)}
              className={`px-4 py-2 rounded-full border-2 ${
                recurrence === key ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {(recurrence === "weekly" || recurrence === "monthly") && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-600">Every</span>
            <input
              type="number"
              min={1}
              max={recurrence === "weekly" ? 52 : 24}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, Math.min(recurrence === "weekly" ? 52 : 24, Number(e.target.value) || 1)))}
              className="w-16 px-3 py-2 text-center text-lg border border-zinc-300 rounded-xl bg-white tabular-nums"
            />
            <span className="text-sm text-zinc-600">{recurrence === "weekly" ? (interval === 1 ? "week" : "weeks") : (interval === 1 ? "month" : "months")}</span>
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={pending || !title.trim()}
        className="w-full py-4 rounded-xl bg-zinc-900 text-white text-lg font-medium disabled:opacity-40"
      >
        {pending ? "Saving…" : "Add event"}
      </button>
    </div>
  );
}
