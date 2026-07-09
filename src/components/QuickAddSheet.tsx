"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { Sheet } from "./Sheet";
import { createEventAction } from "@/app/actions";
import { AddressField } from "./AddressField";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES, memberGlyph } from "@/lib/types";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function QuickAddSheet({
  day,
  hour,
  members,
  onClose,
}: {
  day: Date;
  hour: number;
  members: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [dateStr, setDateStr] = useState(format(day, "yyyy-MM-dd"));
  const [timeStr, setTimeStr] = useState(format(setMinutes(setHours(day, hour), 0), "HH:mm"));
  const [duration, setDuration] = useState(60); // minutes (source of truth)
  const [unit, setUnit] = useState<"min" | "hr">("min");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekdays" | "weekly" | "monthly">("none");
  const [interval, setInterval] = useState(1);
  const [pending, start] = useTransition();

  const startDate = new Date(`${dateStr}T${timeStr || "00:00"}:00`);
  const validWhen = dateStr !== "" && timeStr !== "" && !isNaN(startDate.getTime());
  const endDate = validWhen ? addHours(startDate, duration / 60) : startDate;

  const onSubmit = () => {
    if (!title.trim() || !validWhen) return;
    start(async () => {
      await createEventAction({
        member_ids: Array.from(memberIds),
        title: title.trim(),
        start_ts: Math.floor(startDate.getTime() / 1000),
        end_ts: Math.floor(endDate.getTime() / 1000),
        location: location.trim() || undefined,
        address: address.trim() || null,
        recurrence,
        interval,
      });
      router.refresh();
      onClose();
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title="New event">
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-zinc-500">Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="e.g. Soccer practice"
            className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl focus:outline-none focus:border-zinc-900"
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
                    selected ? `${color.bg} ${color.border} text-white` : "border-zinc-200 text-zinc-700"
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
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-500">When</label>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl focus:outline-none focus:border-zinc-900"
            />
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl focus:outline-none focus:border-zinc-900"
            />
          </div>
          {validWhen && (
            <div className="mt-1 text-sm text-zinc-500">
              {format(startDate, "EEE, MMM d")} · {format(startDate, "h:mm a")} – {format(endDate, "h:mm a")}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-500">Duration</label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[30, 60, 90, 120, 180].map((min) => (
              <button
                key={min}
                onClick={() => setDuration(min)}
                className={`px-4 py-2 rounded-full border-2 ${
                  duration === min ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 text-zinc-700"
                }`}
              >
                {min < 60 ? `${min}m` : `${min / 60}h`}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-1">
              <input
                type="number"
                min={unit === "hr" ? 0.25 : 5}
                max={unit === "hr" ? 24 : 1440}
                step={unit === "hr" ? 0.25 : 5}
                value={unit === "hr" ? +(duration / 60).toFixed(2) : duration}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n) || n <= 0) return;
                  const mins = unit === "hr" ? Math.round(n * 60) : Math.round(n);
                  setDuration(Math.max(1, Math.min(1440, mins)));
                }}
                className="w-20 px-3 py-2 text-center text-lg border border-zinc-300 rounded-xl tabular-nums focus:outline-none focus:border-zinc-900"
              />
              <div className="flex rounded-full border-2 border-zinc-200 overflow-hidden">
                {(["min", "hr"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`px-3 py-2 text-sm ${unit === u ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-500">Repeats</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {([
              ["none", "One-time"],
              ["daily", "Every day"],
              ["weekdays", "Weekdays"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRecurrence(key)}
                className={`px-4 py-2 rounded-full border-2 ${
                  recurrence === key ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 text-zinc-700"
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
                className="w-16 px-3 py-2 text-center text-lg border border-zinc-300 rounded-xl tabular-nums focus:outline-none focus:border-zinc-900"
              />
              <span className="text-sm text-zinc-600">
                {recurrence === "weekly"
                  ? `${interval === 1 ? "week" : "weeks"} on ${validWhen ? format(startDate, "EEEE") : "the start weekday"}`
                  : `${interval === 1 ? "month" : "months"} on the ${validWhen ? ordinal(startDate.getDate()) : "start date"}`}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-zinc-300 text-zinc-700 active:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={pending || !title.trim() || !validWhen}
            className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40 active:bg-zinc-800"
          >
            {pending ? "Saving…" : "Add event"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
