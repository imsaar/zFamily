"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { Sheet } from "./Sheet";
import { createEventAction } from "@/app/actions";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES, memberGlyph } from "@/lib/types";

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
  const [memberId, setMemberId] = useState<number | null>(members[0]?.id ?? null);
  const [duration, setDuration] = useState(60); // minutes
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "monthly" | "quarterly">("none");
  const [pending, start] = useTransition();

  const startDate = setMinutes(setHours(day, hour), 0);
  const endDate = addHours(startDate, duration / 60);

  const onSubmit = () => {
    if (!title.trim()) return;
    start(async () => {
      await createEventAction({
        member_id: memberId,
        title: title.trim(),
        start_ts: Math.floor(startDate.getTime() / 1000),
        end_ts: Math.floor(endDate.getTime() / 1000),
        recurrence,
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
          <label className="text-sm font-medium text-zinc-500">Who</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
              const selected = memberId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMemberId(m.id)}
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
          <label className="text-sm font-medium text-zinc-500">When</label>
          <div className="mt-1 text-lg">
            {format(startDate, "EEE, MMM d · h:mm a")} – {format(endDate, "h:mm a")}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-500">Duration</label>
          <div className="mt-2 flex gap-2">
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
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-500">Repeats</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {([
              ["none", "One-time"],
              ["weekly", "Every week"],
              ["monthly", "Every month"],
              ["quarterly", "Every 3 months"],
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
            disabled={pending || !title.trim()}
            className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40 active:bg-zinc-800"
          >
            {pending ? "Saving…" : "Add event"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
