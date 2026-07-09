"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Sheet } from "./Sheet";
import { deleteEventAction, updateEventAction } from "@/app/actions";
import { useAdminAuth } from "./AdminGate";
import { AddressField } from "./AddressField";
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
  // Not useTransition — it defers the useAdminAuth PIN modal's state update.
  const [pending, setPending] = useState(false);
  const { authenticate, modal } = useAdminAuth();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [memberIds, setMemberIds] = useState<Set<number>>(
    new Set(event.member_ids ?? (event.member_id != null ? [event.member_id] : []))
  );
  const [location, setLocation] = useState(event.location ?? "");
  const [address, setAddress] = useState(event.address ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");

  const isLocal = event.source === "local";

  const handleSave = async () => {
    setPending(true);
    try {
      const ok = await authenticate((auth) =>
        updateEventAction(event.id, { title, member_ids: Array.from(memberIds), location: location || null, address: address || null, notes: notes || null }, auth)
      );
      if (ok) {
        // Close the sheet — reopening it would show the stale `event` prop.
        router.refresh();
        onClose();
      }
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    setPending(true);
    try {
      const ok = await authenticate((auth) => deleteEventAction(event.id, auth));
      if (ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setPending(false);
    }
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
                      className={`px-4 py-2 rounded-full border-2 ${
                        selected ? `${color.bg} ${color.border} text-white` : "border-zinc-200"
                      }`}
                    >
                      {memberGlyph(m)} {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <AddressField name={location} address={address} onNameChange={setLocation} onAddressChange={setAddress} />
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
            {(event.member_ids ?? (event.member_id != null ? [event.member_id] : [])).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(event.member_ids ?? (event.member_id != null ? [event.member_id] : [])).map((id) => (
                  <MemberPill key={id} member={members.find((m) => m.id === id)} />
                ))}
              </div>
            )}
            {(event.location || event.address) && (
              <div className="text-base">
                <div>📍 {event.location || event.address}</div>
                {event.address && event.location && event.address !== event.location && (
                  <div className="text-sm text-zinc-500">{event.address}</div>
                )}
              </div>
            )}
            {event.commute_seconds != null && (
              <div className="text-base text-zinc-600">
                {event.commute_mode === "bus" ? "🚌" : "🚗"} ~{commuteLabel(event.commute_seconds)} from home
                {event.commute_mode === "bus" ? " (est.)" : ""}
              </div>
            )}
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
      {modal}
    </Sheet>
  );
}

export function commuteLabel(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
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
