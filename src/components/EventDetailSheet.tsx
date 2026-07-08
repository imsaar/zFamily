"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Sheet } from "./Sheet";
import { deleteEventAction, updateEventAction } from "@/app/actions";
import type { Member, MemberColor, EventRow } from "@/lib/types";
import { COLOR_CLASSES, memberGlyph } from "@/lib/types";

export function EventDetailSheet({
  event,
  members,
  onClose,
}: {
  event: EventRow;
  members: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [memberId, setMemberId] = useState<number | null>(event.member_id);
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");

  const isLocal = event.source === "local";

  const handleSave = () => {
    start(async () => {
      await updateEventAction(event.id, {
        title,
        member_id: memberId,
        location: location || null,
        notes: notes || null,
      });
      router.refresh();
      setEditing(false);
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this event?")) return;
    start(async () => {
      await deleteEventAction(event.id);
      router.refresh();
      onClose();
    });
  };

  const startD = new Date(event.start_ts * 1000);
  const endD = new Date(event.end_ts * 1000);

  return (
    <Sheet open={true} onClose={onClose} title={editing ? "Edit event" : "Event"}>
      <div className="space-y-5">
        {editing ? (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl"
            />
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
                      className={`px-4 py-2 rounded-full border-2 ${
                        selected ? `${color.bg} ${color.border} text-white` : "border-zinc-200"
                      }`}
                    >
                      {m.emoji} {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="w-full px-4 py-3 border border-zinc-300 rounded-xl"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="w-full px-4 py-3 border border-zinc-300 rounded-xl resize-none"
            />
          </>
        ) : (
          <>
            <div className="text-2xl font-semibold">{event.title}</div>
            <div className="text-base text-zinc-600 tabular-nums">
              {event.all_day
                ? `${format(startD, "EEE, MMM d")} · All day`
                : `${format(startD, "EEE, MMM d · h:mm a")} – ${format(endD, "h:mm a")}`}
            </div>
            {event.member_id && (
              <MemberPill member={members.find((m) => m.id === event.member_id)} />
            )}
            {event.location && <div className="text-base">📍 {event.location}</div>}
            {event.notes && (
              <div className="text-base text-zinc-700 whitespace-pre-wrap">{event.notes}</div>
            )}
            {event.rrule && (
              <div className="text-sm text-zinc-400">↻ Recurring · {event.rrule}</div>
            )}
            {!isLocal && (
              <div className="text-xs text-zinc-400">Synced from Google Calendar</div>
            )}
          </>
        )}

        <div className="flex gap-3 pt-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-300 active:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={pending}
                className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium active:bg-zinc-800"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="px-5 py-3 rounded-xl border border-red-300 text-red-600 active:bg-red-50"
              >
                Delete
              </button>
              {isLocal && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium active:bg-zinc-800"
                >
                  Edit
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function MemberPill({ member }: { member: Member | undefined }) {
  if (!member) return null;
  const color = COLOR_CLASSES[member.color as MemberColor] ?? COLOR_CLASSES.sky;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${color.bgSoft} ${color.text}`}>
      <span>{memberGlyph(member)}</span>
      <span>{member.name}</span>
    </div>
  );
}
