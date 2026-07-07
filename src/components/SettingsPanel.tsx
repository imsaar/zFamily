"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Member, MemberColor, MemberRole } from "@/lib/types";
import { COLOR_CLASSES, MEMBER_COLORS } from "@/lib/types";
import type { ChoreWithAssignees } from "@/lib/chores";
import type { Reward } from "@/lib/types";
import {
  createMemberAction,
  deleteMemberAction,
  updateMemberAction,
  createChoreAction,
  deleteChoreAction,
  updateChoreAction,
  updateSettingAction,
  createRewardAction,
  updateRewardAction,
  deleteRewardAction,
  setMemberPinAction,
  clearMemberPinAction,
  searchCityAction,
  factoryResetAction,
  setMemberPhotoAction,
  clearMemberPhotoAction,
  createIcalFeedAction,
  updateIcalFeedAction,
  deleteIcalFeedAction,
  syncIcalFeedsAction,
} from "@/app/actions";
import type { GeocodeResult } from "@/lib/geocode";
import type { IcalFeed } from "@/lib/ical";
import { Sheet } from "./Sheet";
import { useAdminAuth } from "./AdminGate";
import { PinPadModal } from "./PinPad";
import { MemberAvatar } from "./MemberAvatar";
import { readImageAsResizedDataUrl } from "@/lib/image";

type Tab = "members" | "chores" | "rewards" | "calendars" | "weather" | "display" | "advanced";

export function SettingsPanel({
  members,
  chores,
  rewards,
  settings,
  feeds,
}: {
  members: Member[];
  chores: ChoreWithAssignees[];
  rewards: Reward[];
  settings: Record<string, string>;
  feeds: IcalFeed[];
}) {
  const [tab, setTab] = useState<Tab>("members");

  return (
    <div className="h-full flex bg-zinc-50">
      <nav className="w-56 border-r border-zinc-200 bg-white py-4">
        {([
          ["members", "👥 Family"],
          ["chores", "✅ Chores"],
          ["rewards", "🏆 Rewards"],
          ["calendars", "📆 Calendars"],
          ["weather", "🌤️ Weather"],
          ["display", "🌙 Display"],
          ["advanced", "⚠️ Advanced"],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`w-full text-left px-6 py-3 text-base ${
              tab === key ? "bg-zinc-100 font-semibold" : "text-zinc-600"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-8">
        {tab === "members" && <MembersTab members={members} />}
        {tab === "chores" && <ChoresTab chores={chores} members={members} />}
        {tab === "rewards" && <RewardsTab rewards={rewards} />}
        {tab === "calendars" && <CalendarsTab feeds={feeds} members={members} />}
        {tab === "weather" && <WeatherTab settings={settings} />}
        {tab === "display" && <DisplayTab settings={settings} />}
        {tab === "advanced" && <AdvancedTab />}
      </div>
    </div>
  );
}

function MembersTab({ members }: { members: Member[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const { authenticate, modal } = useAdminAuth();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Family members</h2>
        <button
          onClick={() => setEditing("new")}
          className="px-5 py-3 rounded-xl bg-zinc-900 text-white font-medium"
        >
          + Add member
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {members.map((m) => {
          const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
          return (
            <div key={m.id} className="bg-white rounded-2xl border border-zinc-200 p-5 flex items-center gap-4">
              <MemberAvatar member={m} className="w-14 h-14 rounded-full shrink-0" textClass="text-2xl" />
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold flex items-center gap-2">
                  {m.name}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "parent" ? "bg-zinc-100 text-zinc-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {m.role === "parent" ? "Parent" : "Child"}
                  </span>
                </div>
                {m.nickname?.trim() && (
                  <div className={`text-sm ${color.text} truncate`}>“{m.nickname}”</div>
                )}
              </div>
              <button
                onClick={() => setEditing(m)}
                className="px-4 py-2 rounded-lg border border-zinc-300"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete ${m.name}?`)) return;
                  setPending(true);
                  try {
                    const ok = await authenticate((auth) => deleteMemberAction(m.id, auth));
                    if (ok) router.refresh();
                  } finally {
                    setPending(false);
                  }
                }}
                disabled={pending}
                className="px-3 py-2 rounded-lg text-red-600"
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <MemberEditor
          member={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {modal}
    </div>
  );
}

function MemberEditor({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { authenticate, modal } = useAdminAuth();
  const [pinPad, setPinPad] = useState<null | "set" | "clear">(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [name, setName] = useState(member?.name ?? "");
  const [nickname, setNickname] = useState(member?.nickname ?? "");
  const [color, setColor] = useState<MemberColor>((member?.color as MemberColor) ?? "sky");
  const [emoji, setEmoji] = useState(member?.emoji ?? "");
  const [role, setRole] = useState<MemberRole>(member?.role ?? "parent");

  const onSave = async () => {
    if (!name.trim()) return;
    setPending(true);
    try {
      const data = { name: name.trim(), nickname: nickname.trim() || null, color, emoji: emoji || null, role };
      const ok = await authenticate((auth) => {
        if (member) return updateMemberAction(member.id, data, auth);
        return createMemberAction(data, auth);
      });
      if (ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={member ? "Edit member" : "Add member"}>
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-zinc-500">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Nickname (optional)</label>
          <input
            value={nickname ?? ""}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="What the family calls them"
            className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl"
          />
          <p className="text-xs text-zinc-500 mt-1">Shown around the app in place of their name when set.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Avatar emoji (optional)</label>
          <input
            value={emoji ?? ""}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="👧"
            maxLength={4}
            className="mt-1 w-24 px-4 py-3 text-center text-2xl border border-zinc-300 rounded-xl"
          />
          <p className="text-xs text-zinc-500 mt-1">
            {member ? "Used when no headshot photo is set." : "You can upload a headshot photo after saving."}
          </p>
        </div>
        {member && <PhotoUploader member={member} />}
        <div>
          <label className="text-sm font-medium text-zinc-500">Role</label>
          <div className="mt-2 flex gap-2">
            {(["parent", "child"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-5 py-2 rounded-full border-2 ${
                  role === r ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200"
                }`}
              >
                {r === "parent" ? "👨‍👩 Parent" : "🧒 Child"}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Parents verify chores (children need a parent's ✓; parents need another parent's ✓).
          </p>
        </div>
        {member && (
          <div className="border-t border-zinc-100 pt-4">
            <label className="text-sm font-medium text-zinc-500">4-digit PIN</label>
            <div className="mt-2 flex items-center gap-3">
              <div className="text-sm">
                {member.pin_hash ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    🔒 PIN set
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-100 text-zinc-600">
                    No PIN
                  </span>
                )}
              </div>
              <button
                onClick={() => { setPinError(null); setPinPad("set"); }}
                className="px-4 py-2 rounded-xl border-2 border-zinc-300 text-sm"
              >
                {member.pin_hash ? "Change PIN" : "Set PIN"}
              </button>
              {member.pin_hash && (
                <button
                  onClick={() => { setPinError(null); setPinPad("clear"); }}
                  className="px-4 py-2 rounded-xl text-red-600 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Required for personal actions (verify, vote, redeem) and — for parents — admin actions.
            </p>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-zinc-500">Color</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {MEMBER_COLORS.map((c) => {
              const cl = COLOR_CLASSES[c];
              return (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-12 h-12 rounded-full ${cl.bg} ${
                    color === c ? "ring-4 ring-offset-2 ring-zinc-900" : ""
                  }`}
                />
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-300">Cancel</button>
          <button
            onClick={onSave}
            disabled={pending || !name.trim()}
            className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
      {member && pinPad && (
        <MemberPinManager
          member={member}
          mode={pinPad}
          error={pinError}
          onError={setPinError}
          onDone={() => {
            setPinPad(null);
            router.refresh();
          }}
          onCancel={() => setPinPad(null)}
        />
      )}
      {modal}
    </Sheet>
  );
}

function PhotoUploader({ member }: { member: Member }) {
  const router = useRouter();
  const { authenticate, modal } = useAdminAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const dataUrl = await readImageAsResizedDataUrl(file);
      const ok = await authenticate((auth) => setMemberPhotoAction(member.id, dataUrl, auth));
      if (ok) router.refresh();
    } catch {
      setError("Couldn’t read that image. Try a JPG or PNG.");
    } finally {
      setPending(false);
    }
  };

  const removePhoto = async () => {
    setPending(true);
    setError(null);
    try {
      const ok = await authenticate((auth) => clearMemberPhotoAction(member.id, auth));
      if (ok) router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="border-t border-zinc-100 pt-4">
      <label className="text-sm font-medium text-zinc-500">Headshot photo (optional)</label>
      <div className="mt-2 flex items-center gap-4">
        <MemberAvatar member={member} className="w-20 h-20 rounded-full shrink-0" textClass="text-3xl" />
        <div className="flex flex-col gap-2">
          <label className={`px-4 py-2 rounded-xl border-2 border-zinc-300 text-sm cursor-pointer text-center ${pending ? "opacity-50 pointer-events-none" : ""}`}>
            {member.photo_updated_at ? "Change photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={pending}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {member.photo_updated_at && (
            <button onClick={removePhoto} disabled={pending} className="px-4 py-2 rounded-xl text-red-600 text-sm text-left">
              Remove photo
            </button>
          )}
        </div>
      </div>
      {pending && <p className="text-xs text-zinc-500 mt-2">Saving…</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-zinc-500 mt-2">
        Photos are cropped to a square and resized on-device. Stored locally in your family database.
      </p>
      {modal}
    </div>
  );
}

function MemberPinManager({
  member,
  mode,
  error,
  onError,
  onDone,
  onCancel,
}: {
  member: Member;
  mode: "set" | "clear";
  error: string | null;
  onError: (e: string | null) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<"current" | "new" | "confirm">(
    member.pin_hash ? "current" : "new"
  );
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);

  const onSubmit = async (pin: string) => {
    if (phase === "current") {
      if (mode === "clear") {
        const r = await clearMemberPinAction(member.id, pin);
        if (!r.ok) return onError(r.reason ?? "pin_invalid");
        onError(null);
        onDone();
        return;
      }
      setCurrentPin(pin);
      setPhase("new");
      return;
    }
    if (phase === "new") {
      setNewPin(pin);
      setPhase("confirm");
      return;
    }
    // confirm
    if (pin !== newPin) {
      onError("pin_invalid");
      setPhase("new");
      setNewPin(null);
      return;
    }
    const r = await setMemberPinAction(member.id, pin, currentPin);
    if (!r.ok) return onError(r.reason ?? "pin_invalid");
    onError(null);
    onDone();
  };

  const purposeText: Record<typeof phase, string> = {
    current: mode === "clear" ? "Confirm current PIN to remove it" : "Enter current PIN",
    new: mode === "clear" ? "Confirm to remove" : "Choose a new 4-digit PIN",
    confirm: "Re-enter new PIN to confirm",
  };

  return (
    <PinPadModal
      key={phase}
      member={member}
      purpose={purposeText[phase]}
      onSubmit={onSubmit}
      onCancel={onCancel}
      error={error}
    />
  );
}

const RECURRENCES: Array<[string, string]> = [
  ["daily", "Every day"],
  ["weekdays", "Weekdays"],
  ["weekends", "Weekends"],
  ["weekly:MON", "Mondays"],
  ["weekly:TUE", "Tuesdays"],
  ["weekly:WED", "Wednesdays"],
  ["weekly:THU", "Thursdays"],
  ["weekly:FRI", "Fridays"],
  ["weekly:SAT", "Saturdays"],
  ["weekly:SUN", "Sundays"],
];

function ChoresTab({ chores, members }: { chores: ChoreWithAssignees[]; members: Member[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<ChoreWithAssignees | "new" | null>(null);
  const { authenticate, modal } = useAdminAuth();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Chores</h2>
        <button
          onClick={() => setEditing("new")}
          className="px-5 py-3 rounded-xl bg-zinc-900 text-white font-medium"
        >
          + Add chore
        </button>
      </div>
      <div className="space-y-3">
        {chores.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-4">
            <div className="text-3xl w-12 text-center">{c.icon}</div>
            <div className="flex-1">
              <div className="text-lg font-medium">{c.title}</div>
              <div className="text-sm text-zinc-500">
                {RECURRENCES.find(([r]) => r === c.recurrence)?.[1] ?? c.recurrence} · {c.points} pts
              </div>
              <div className="flex gap-1 mt-1">
                {c.assignees.map((aid) => {
                  const m = members.find((mm) => mm.id === aid);
                  if (!m) return null;
                  const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
                  return (
                    <span key={aid} className={`text-xs px-2 py-0.5 rounded-full ${color.bgSoft} ${color.text}`}>
                      {m.name}
                    </span>
                  );
                })}
              </div>
            </div>
            <button onClick={() => setEditing(c)} className="px-4 py-2 rounded-lg border border-zinc-300">Edit</button>
            <button
              onClick={async () => {
                if (!confirm(`Delete chore "${c.title}"?`)) return;
                setPending(true);
                try {
                  const ok = await authenticate((auth) => deleteChoreAction(c.id, auth));
                  if (ok) router.refresh();
                } finally {
                  setPending(false);
                }
              }}
              disabled={pending}
              className="px-3 py-2 rounded-lg text-red-600"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <ChoreEditor
          chore={editing === "new" ? null : editing}
          members={members}
          onClose={() => setEditing(null)}
        />
      )}
      {modal}
    </div>
  );
}

function ChoreEditor({
  chore,
  members,
  onClose,
}: {
  chore: ChoreWithAssignees | null;
  members: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { authenticate, modal } = useAdminAuth();
  const [title, setTitle] = useState(chore?.title ?? "");
  const [icon, setIcon] = useState(chore?.icon ?? "📋");
  const [points, setPoints] = useState(chore?.points ?? 1);
  const [recurrence, setRecurrence] = useState(chore?.recurrence ?? "daily");
  const [assignees, setAssignees] = useState<Set<number>>(new Set(chore?.assignees ?? []));

  const onSave = async () => {
    if (!title.trim()) return;
    setPending(true);
    try {
      const data = {
        title: title.trim(),
        icon: icon || null,
        points,
        recurrence,
        assignees: Array.from(assignees),
      };
      const ok = await authenticate((auth) => {
        if (chore) return updateChoreAction(chore.id, data, auth);
        return createChoreAction(data, auth);
      });
      if (ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={chore ? "Edit chore" : "Add chore"} width="max-w-xl">
      <div className="space-y-5">
        <div className="flex gap-3">
          <input
            value={icon ?? ""}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={4}
            className="w-20 px-4 py-3 text-center text-2xl border border-zinc-300 rounded-xl"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Make bed"
            className="flex-1 px-4 py-3 text-lg border border-zinc-300 rounded-xl"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">When</label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            className="mt-1 w-full px-4 py-3 border border-zinc-300 rounded-xl bg-white text-lg"
          >
            {RECURRENCES.map(([r, l]) => (
              <option key={r} value={r}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Points</label>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 5, 10].map((p) => (
              <button
                key={p}
                onClick={() => setPoints(p)}
                className={`px-5 py-2 rounded-full border-2 ${
                  points === p ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200"
                }`}
              >
                {p}pt
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Assigned to</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
              const selected = assignees.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    const next = new Set(assignees);
                    if (next.has(m.id)) next.delete(m.id);
                    else next.add(m.id);
                    setAssignees(next);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${
                    selected ? `${color.bg} ${color.border} text-white` : "border-zinc-200"
                  }`}
                >
                  <span>{m.emoji ?? m.name[0]}</span>
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-300">Cancel</button>
          <button
            onClick={onSave}
            disabled={pending || !title.trim() || assignees.size === 0}
            className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
      {modal}
    </Sheet>
  );
}

function RewardsTab({ rewards }: { rewards: Reward[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Reward | "new" | null>(null);
  const { authenticate, modal } = useAdminAuth();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Rewards</h2>
          <p className="text-sm text-zinc-500 mt-1">Points come from verified chores. Children spend points on rewards (with parent approval).</p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="px-5 py-3 rounded-xl bg-zinc-900 text-white font-medium"
        >
          + Add reward
        </button>
      </div>
      <div className="space-y-3">
        {rewards.length === 0 && (
          <div className="text-center text-zinc-400 italic py-8">No rewards yet.</div>
        )}
        {rewards.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-4">
            <div className="text-3xl w-12 text-center">{r.icon ?? "🎁"}</div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-medium truncate">{r.title}</div>
              {r.description && <div className="text-sm text-zinc-500 truncate">{r.description}</div>}
            </div>
            <div className="text-lg font-semibold text-amber-600 tabular-nums">{r.points_cost} pts</div>
            <button onClick={() => setEditing(r)} className="px-4 py-2 rounded-lg border border-zinc-300">Edit</button>
            <button
              onClick={async () => {
                if (!confirm(`Delete "${r.title}"?`)) return;
                setPending(true);
                try {
                  const ok = await authenticate((auth) => deleteRewardAction(r.id, auth));
                  if (ok) router.refresh();
                } finally {
                  setPending(false);
                }
              }}
              disabled={pending}
              className="px-3 py-2 rounded-lg text-red-600"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <RewardEditor reward={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {modal}
    </div>
  );
}

function RewardEditor({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { authenticate, modal } = useAdminAuth();
  const [title, setTitle] = useState(reward?.title ?? "");
  const [icon, setIcon] = useState(reward?.icon ?? "🎁");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [cost, setCost] = useState(String(reward?.points_cost ?? 10));

  const save = async () => {
    if (!title.trim()) return;
    const points = Math.max(0, Math.round(Number(cost) || 0));
    setPending(true);
    try {
      const data = { title: title.trim(), icon: icon || null, description: description || null, points_cost: points };
      const ok = await authenticate((auth) => {
        if (reward) return updateRewardAction(reward.id, data, auth);
        return createRewardAction(data, auth);
      });
      if (ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={reward ? "Edit reward" : "Add reward"} width="max-w-xl">
      <div className="space-y-4">
        <div className="flex gap-3">
          <input value={icon ?? ""} onChange={(e) => setIcon(e.target.value)} maxLength={4} className="w-20 px-4 py-3 text-center text-2xl border border-zinc-300 rounded-xl" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reward title" className="flex-1 px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
        </div>
        <textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full px-4 py-3 border border-zinc-300 rounded-xl resize-none"
        />
        <div>
          <label className="text-sm font-medium text-zinc-500">Points cost</label>
          <input
            type="number"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="mt-1 w-32 px-4 py-3 text-lg border border-zinc-300 rounded-xl tabular-nums"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-300">Cancel</button>
          <button
            onClick={save}
            disabled={pending || !title.trim()}
            className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
      {modal}
    </Sheet>
  );
}

function WeatherTab({ settings }: { settings: Record<string, string> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { authenticate, modal } = useAdminAuth();
  const [label, setLabel] = useState(settings.weather_label ?? "");
  const [lat, setLat] = useState(settings.weather_lat ?? "");
  const [lon, setLon] = useState(settings.weather_lon ?? "");
  const [tz, setTz] = useState(settings.weather_tz ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState(false);

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await searchCityAction(query);
      setResults(r.results);
    } finally {
      setSearching(false);
    }
  };

  const pick = (r: GeocodeResult) => {
    const bits = [r.name, r.admin1, r.countryCode].filter(Boolean).join(", ");
    setLabel(bits);
    setLat(r.latitude.toFixed(4));
    setLon(r.longitude.toFixed(4));
    setTz(r.timezone);
    setResults([]);
    setQuery("");
  };

  const save = async () => {
    setPending(true);
    setSaved(false);
    try {
      const ok = await authenticate(async (auth) => {
        const updates: Array<[string, string]> = [
          ["weather_label", label],
          ["weather_lat", lat],
          ["weather_lon", lon],
          ["weather_tz", tz],
        ];
        for (const [k, v] of updates) {
          const r = await updateSettingAction(k, v, auth);
          if (!r.ok) return r;
        }
        return { ok: true };
      });
      if (ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <h2 className="text-2xl font-semibold mb-2">Weather</h2>
      <p className="text-zinc-500 text-sm">Powered by Open-Meteo (no API key). Search a city to auto-fill coordinates and timezone.</p>

      <div>
        <label className="text-sm font-medium text-zinc-500">Search city, state or country</label>
        <div className="mt-1 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="e.g. Austin, Texas"
            className="flex-1 px-4 py-3 text-lg border border-zinc-300 rounded-xl"
          />
          <button
            onClick={runSearch}
            disabled={searching || query.trim().length < 2}
            className="px-5 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40"
          >
            {searching ? "Searching…" : "🔍 Search"}
          </button>
        </div>
        {results.length > 0 && (
          <ul className="mt-2 border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 bg-white">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => pick(r)}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-50 active:bg-zinc-100"
                >
                  <div className="font-medium">
                    {r.name}
                    {r.admin1 ? `, ${r.admin1}` : ""}
                    {r.country ? ` · ${r.country}` : ""}
                  </div>
                  <div className="text-xs text-zinc-500 tabular-nums">
                    {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)} · {r.timezone}
                    {r.population ? ` · pop ${r.population.toLocaleString()}` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {results.length === 0 && searching === false && query.trim().length >= 2 && (
          <div className="mt-2 text-sm text-zinc-400 italic">Enter → search. No results yet.</div>
        )}
      </div>

      <div className="border-t border-zinc-100 pt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-zinc-500">Location label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-500">Latitude</label>
            <input value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl tabular-nums" />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-500">Longitude</label>
            <input value={lon} onChange={(e) => setLon(e.target.value)} className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl tabular-nums" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Timezone (IANA)</label>
          <input
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="America/Los_Angeles"
            className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Used for all clocks and dates in the app. Auto-filled when you pick a city above.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="px-6 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-emerald-600 text-sm">✓ Saved</span>}
      </div>
      {modal}
    </div>
  );
}

function DisplayTab({ settings }: { settings: Record<string, string> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const { authenticate, modal } = useAdminAuth();
  const [quietStart, setQuietStart] = useState(settings.quiet_start ?? "21:00");
  const [quietEnd, setQuietEnd] = useState(settings.quiet_end ?? "07:00");
  const [resetHour, setResetHour] = useState(settings.chore_reset_hour ?? "4");
  const [idleMin, setIdleMin] = useState(String(Math.round(Number(settings.idle_seconds ?? "300") / 60)));
  const [ssMode, setSsMode] = useState(settings.screensaver_mode ?? "clock");
  const [personalIdleMin, setPersonalIdleMin] = useState(
    String(Math.round(Number(settings.personal_idle_seconds ?? "120") / 60))
  );
  const [hijriOffset, setHijriOffset] = useState(String(Number(settings.hijri_offset ?? "0")));

  const save = async () => {
    setPending(true);
    setSaved(false);
    try {
      const ok = await authenticate(async (auth) => {
        const updates: Array<[string, string]> = [
          ["quiet_start", quietStart],
          ["quiet_end", quietEnd],
          ["chore_reset_hour", resetHour],
          ["idle_seconds", String(Math.max(30, Number(idleMin) * 60))],
          ["screensaver_mode", ssMode],
          ["personal_idle_seconds", String(Math.max(30, Number(personalIdleMin) * 60))],
          ["hijri_offset", String(Math.max(-3, Math.min(3, Number(hijriOffset) || 0)))],
        ];
        for (const [k, v] of updates) {
          const r = await updateSettingAction(k, v, auth);
          if (!r.ok) return r;
        }
        return { ok: true };
      });
      if (ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <h2 className="text-2xl font-semibold mb-2">Display & quiet hours</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-zinc-500">Quiet hours start</label>
          <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Quiet hours end</label>
          <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-500">Idle before screensaver (minutes)</label>
        <input type="number" min={1} max={60} value={idleMin} onChange={(e) => setIdleMin(e.target.value)} className="mt-1 w-32 px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-500">Screensaver mode</label>
        <div className="mt-2 flex gap-2">
          {(["clock", "clock+next"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSsMode(m)}
              className={`px-5 py-2 rounded-full border-2 ${
                ssMode === m ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200"
              }`}
            >
              {m === "clock" ? "Clock only" : "Clock + next event"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-500">Personal view auto-revert (minutes)</label>
        <input type="number" min={1} max={30} value={personalIdleMin} onChange={(e) => setPersonalIdleMin(e.target.value)} className="mt-1 w-32 px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
        <p className="text-sm text-zinc-500 mt-1">
          When someone opens their personal view, it reverts to the family home after this long idle.
        </p>
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-500">Chore reset hour (0–23)</label>
        <input type="number" min={0} max={23} value={resetHour} onChange={(e) => setResetHour(e.target.value)} className="mt-1 w-32 px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
        <p className="text-sm text-zinc-500 mt-1">Daily chores reset at this hour each day.</p>
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-500">🌙 Hijri date correction (days)</label>
        <input
          type="number"
          min={-3}
          max={3}
          value={hijriOffset}
          onChange={(e) => setHijriOffset(e.target.value)}
          className="mt-1 w-32 px-4 py-3 text-lg border border-zinc-300 rounded-xl tabular-nums"
        />
        <p className="text-sm text-zinc-500 mt-1">
          Shift the Islamic (Umm al-Qura) date by ±3 days to match your local moon-sighting authority.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="px-6 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-emerald-600 text-sm">✓ Saved</span>}
      </div>
      {modal}
    </div>
  );
}

function GoogleAccountsSection({ members }: { members: Member[] }) {
  return (
    <section>
      <h3 className="text-lg font-semibold">Google accounts</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4">
        Link each family member to their Google account to pull events from their personal calendar
        (two-way, via OAuth). Events created on phones flow into zFamily automatically.
      </p>

      <div className="space-y-3">
        {members.map((m) => (
          <div key={m.id} className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-medium">{m.name}</div>
              <div className="text-sm text-zinc-500">
                {m.google_calendar_id ? `Linked: ${m.google_calendar_id}` : "Not linked"}
              </div>
            </div>
            <a
              href={`/api/auth/google/start?memberId=${m.id}`}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white"
            >
              {m.google_calendar_id ? "Re-link" : "Link Google"}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
        <strong>Setup required:</strong> Set the env vars <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,
        and <code>ZFAMILY_BASE_URL</code> before linking. See README for details.
      </div>
    </section>
  );
}

function CalendarsTab({ feeds, members }: { feeds: IcalFeed[]; members: Member[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<IcalFeed | "new" | null>(null);
  const { authenticate, modal } = useAdminAuth();

  const syncAll = async () => {
    setSyncing(true);
    try {
      await syncIcalFeedsAction({ force: true });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-10">
      <h2 className="text-2xl font-semibold">Calendars</h2>

      <GoogleAccountsSection members={members} />

      <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Calendar subscriptions</h3>
        <div className="flex gap-2">
          {feeds.length > 0 && (
            <button onClick={syncAll} disabled={syncing} className="px-4 py-3 rounded-xl border border-zinc-300 disabled:opacity-50">
              {syncing ? "Syncing…" : "🔄 Sync all"}
            </button>
          )}
          <button onClick={() => setEditing("new")} className="px-5 py-3 rounded-xl bg-zinc-900 text-white font-medium">
            + Add calendar
          </button>
        </div>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        Subscribe to a read-only calendar by its iCal URL. In Google Calendar, open a calendar’s
        <strong> Settings → Integrate calendar → Secret address in iCal format</strong> and paste that link here.
        Events refresh automatically on each calendar’s interval and show up across the app.
      </p>

      <div className="space-y-3">
        {feeds.length === 0 && (
          <div className="text-center text-zinc-400 italic py-8 border-2 border-dashed border-zinc-200 rounded-2xl">
            No calendar subscriptions yet.
          </div>
        )}
        {feeds.map((f) => {
          const m = f.member_id ? members.find((x) => x.id === f.member_id) : null;
          const color = m ? COLOR_CLASSES[m.color as MemberColor] : null;
          const err = f.last_status?.startsWith("error");
          return (
            <div key={f.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-4">
              <div className="text-2xl w-10 text-center">📆</div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-medium flex items-center gap-2">
                  {f.name}
                  {m && color && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${color.bgSoft} ${color.text}`}>{m.name}</span>
                  )}
                  {!f.active && <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">Paused</span>}
                </div>
                <div className="text-sm text-zinc-500 truncate">{maskUrl(f.url)}</div>
                <div className={`text-xs mt-0.5 ${err ? "text-red-600" : "text-zinc-400"}`}>
                  every {f.interval_hours}h · {syncStatus(f)}
                </div>
              </div>
              <button onClick={() => setEditing(f)} className="px-4 py-2 rounded-lg border border-zinc-300">Edit</button>
              <button
                onClick={async () => {
                  if (!confirm(`Remove the "${f.name}" subscription and its events?`)) return;
                  setPending(true);
                  try {
                    const ok = await authenticate((auth) => deleteIcalFeedAction(f.id, auth));
                    if (ok) router.refresh();
                  } finally {
                    setPending(false);
                  }
                }}
                disabled={pending}
                className="px-3 py-2 rounded-lg text-red-600"
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>
      </section>

      {editing && (
        <FeedEditor feed={editing === "new" ? null : editing} members={members} onClose={() => setEditing(null)} />
      )}
      {modal}
    </div>
  );
}

function FeedEditor({ feed, members, onClose }: { feed: IcalFeed | null; members: Member[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authenticate, modal } = useAdminAuth();
  const [name, setName] = useState(feed?.name ?? "");
  const [url, setUrl] = useState(feed?.url ?? "");
  const [memberId, setMemberId] = useState<number | null>(feed?.member_id ?? null);
  const [interval, setIntervalHours] = useState(String(feed?.interval_hours ?? 6));
  const [active, setActive] = useState(feed ? feed.active === 1 : true);

  const save = async () => {
    if (!name.trim() || !url.trim()) {
      setError("Name and iCal URL are required.");
      return;
    }
    const hours = Math.max(1, Math.min(168, Math.round(Number(interval) || 6)));
    setPending(true);
    setError(null);
    try {
      const ok = await authenticate((auth) => {
        if (feed) return updateIcalFeedAction(feed.id, { name, url, member_id: memberId, interval_hours: hours, active: active ? 1 : 0 }, auth);
        return createIcalFeedAction({ name, url, member_id: memberId, interval_hours: hours }, auth);
      });
      if (ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={feed ? "Edit calendar" : "Add calendar"} width="max-w-xl">
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-zinc-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. School calendar" className="mt-1 w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl" />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Secret iCal address (URL)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            className="mt-1 w-full px-4 py-3 text-base border border-zinc-300 rounded-xl font-mono"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Keep this private — anyone with the link can read the calendar. `webcal://` links are accepted.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Show as (member color, optional)</label>
          <select
            value={memberId ?? ""}
            onChange={(e) => setMemberId(e.target.value ? Number(e.target.value) : null)}
            className="mt-1 w-full px-4 py-3 border border-zinc-300 rounded-xl bg-white text-lg"
          >
            <option value="">Family (no member)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Sync every (hours)</label>
          <input type="number" min={1} max={168} value={interval} onChange={(e) => setIntervalHours(e.target.value)} className="mt-1 w-32 px-4 py-3 text-lg border border-zinc-300 rounded-xl tabular-nums" />
        </div>
        {feed && (
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-5 h-5" />
            <span className="text-sm text-zinc-600">Active (uncheck to pause syncing)</span>
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-300">Cancel</button>
          <button onClick={save} disabled={pending || !name.trim() || !url.trim()} className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40">
            {pending ? "Saving…" : "Save & sync"}
          </button>
        </div>
      </div>
      {modal}
    </Sheet>
  );
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}/…${url.slice(-14)}`;
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "…" : url;
  }
}

function syncStatus(f: IcalFeed): string {
  if (!f.last_synced_at) return "not synced yet";
  const ago = Math.floor(Date.now() / 1000) - f.last_synced_at;
  const rel = ago < 60 ? "just now" : ago < 3600 ? `${Math.floor(ago / 60)}m ago` : ago < 86400 ? `${Math.floor(ago / 3600)}h ago` : `${Math.floor(ago / 86400)}d ago`;
  if (f.last_status?.startsWith("error")) return `${f.last_status} (${rel})`;
  return `synced ${rel}${f.last_event_count != null ? ` · ${f.last_event_count} events` : ""}`;
}

function AdvancedTab() {
  const router = useRouter();
  const { authenticate, modal } = useAdminAuth();
  const [pending, setPending] = useState(false);

  const reset = async () => {
    if (!confirm("Factory reset erases ALL data — family members, chores, meal plans, rewards, PINs, and settings. This cannot be undone. Continue?")) {
      return;
    }
    if (!confirm("Are you absolutely sure? The app will restart from the first-run family setup.")) {
      return;
    }
    setPending(true);
    try {
      const ok = await authenticate((auth) => factoryResetAction(auth));
      if (ok) router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold mb-2">Advanced</h2>
      <p className="text-zinc-500 mb-8">Maintenance actions for this device.</p>

      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6">
        <h3 className="text-lg font-semibold text-red-900">⚠️ Factory reset</h3>
        <p className="text-sm text-red-800 mt-2 mb-5">
          Permanently erase everything — family members, chores and completions, calendar events,
          meal plans and shopping lists, rewards, PINs, and settings — and start over from the
          first-run family setup. Google account links are removed too. This cannot be undone.
        </p>
        <button
          onClick={reset}
          disabled={pending}
          className="px-6 py-3 rounded-xl bg-red-600 text-white font-medium disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Erase all data & reset"}
        </button>
      </div>
      {modal}
    </div>
  );
}
