"use client";

import { useState, useTransition } from "react";
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
} from "@/app/actions";
import { Sheet } from "./Sheet";
import { useAdminAuth } from "./AdminGate";
import { PinPadModal } from "./PinPad";

type Tab = "members" | "chores" | "rewards" | "weather" | "display" | "google";

export function SettingsPanel({
  members,
  chores,
  rewards,
  settings,
}: {
  members: Member[];
  chores: ChoreWithAssignees[];
  rewards: Reward[];
  settings: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>("members");

  return (
    <div className="h-full flex bg-zinc-50">
      <nav className="w-56 border-r border-zinc-200 bg-white py-4">
        {([
          ["members", "👥 Family"],
          ["chores", "✅ Chores"],
          ["rewards", "🏆 Rewards"],
          ["weather", "🌤️ Weather"],
          ["display", "🌙 Display"],
          ["google", "🔗 Google"],
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
        {tab === "weather" && <WeatherTab settings={settings} />}
        {tab === "display" && <DisplayTab settings={settings} />}
        {tab === "google" && <GoogleTab members={members} />}
      </div>
    </div>
  );
}

function MembersTab({ members }: { members: Member[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
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
              <div className={`w-14 h-14 rounded-full ${color.bg} flex items-center justify-center text-2xl text-white`}>
                {m.emoji ?? m.name[0]}
              </div>
              <div className="flex-1">
                <div className="text-lg font-semibold flex items-center gap-2">
                  {m.name}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === "parent" ? "bg-zinc-100 text-zinc-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {m.role === "parent" ? "Parent" : "Child"}
                  </span>
                </div>
                <div className={`text-sm ${color.text}`}>{m.color}</div>
              </div>
              <button
                onClick={() => setEditing(m)}
                className="px-4 py-2 rounded-lg border border-zinc-300"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Delete ${m.name}?`)) return;
                  start(async () => {
                    const ok = await authenticate((auth) => deleteMemberAction(m.id, auth));
                    if (ok) router.refresh();
                  });
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
  const [pending, start] = useTransition();
  const { authenticate, modal } = useAdminAuth();
  const [pinPad, setPinPad] = useState<null | "set" | "clear">(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [name, setName] = useState(member?.name ?? "");
  const [color, setColor] = useState<MemberColor>((member?.color as MemberColor) ?? "sky");
  const [emoji, setEmoji] = useState(member?.emoji ?? "");
  const [role, setRole] = useState<MemberRole>(member?.role ?? "parent");

  const onSave = () => {
    if (!name.trim()) return;
    start(async () => {
      const ok = await authenticate((auth) => {
        if (member) return updateMemberAction(member.id, { name, color, emoji: emoji || null, role }, auth);
        return createMemberAction({ name, color, emoji: emoji || null, role }, auth);
      });
      if (ok) {
        router.refresh();
        onClose();
      }
    });
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
          <label className="text-sm font-medium text-zinc-500">Avatar emoji (optional)</label>
          <input
            value={emoji ?? ""}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="👧"
            maxLength={4}
            className="mt-1 w-24 px-4 py-3 text-center text-2xl border border-zinc-300 rounded-xl"
          />
        </div>
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
  const [pending, start] = useTransition();
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
              onClick={() => {
                if (!confirm(`Delete chore "${c.title}"?`)) return;
                start(async () => {
                  const ok = await authenticate((auth) => deleteChoreAction(c.id, auth));
                  if (ok) router.refresh();
                });
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
  const [pending, start] = useTransition();
  const { authenticate, modal } = useAdminAuth();
  const [title, setTitle] = useState(chore?.title ?? "");
  const [icon, setIcon] = useState(chore?.icon ?? "📋");
  const [points, setPoints] = useState(chore?.points ?? 1);
  const [recurrence, setRecurrence] = useState(chore?.recurrence ?? "daily");
  const [assignees, setAssignees] = useState<Set<number>>(new Set(chore?.assignees ?? []));

  const onSave = () => {
    if (!title.trim()) return;
    start(async () => {
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
    });
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
  const [pending, start] = useTransition();
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
              onClick={() => {
                if (!confirm(`Delete "${r.title}"?`)) return;
                start(async () => {
                  const ok = await authenticate((auth) => deleteRewardAction(r.id, auth));
                  if (ok) router.refresh();
                });
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
  const [pending, start] = useTransition();
  const { authenticate, modal } = useAdminAuth();
  const [title, setTitle] = useState(reward?.title ?? "");
  const [icon, setIcon] = useState(reward?.icon ?? "🎁");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [cost, setCost] = useState(String(reward?.points_cost ?? 10));

  const save = () => {
    if (!title.trim()) return;
    const points = Math.max(0, Math.round(Number(cost) || 0));
    start(async () => {
      const data = { title: title.trim(), icon: icon || null, description: description || null, points_cost: points };
      const ok = await authenticate((auth) => {
        if (reward) return updateRewardAction(reward.id, data, auth);
        return createRewardAction(data, auth);
      });
      if (ok) {
        router.refresh();
        onClose();
      }
    });
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
  const [pending, start] = useTransition();
  const { authenticate, modal } = useAdminAuth();
  const [label, setLabel] = useState(settings.weather_label ?? "");
  const [lat, setLat] = useState(settings.weather_lat ?? "");
  const [lon, setLon] = useState(settings.weather_lon ?? "");

  const save = () => {
    start(async () => {
      const ok = await authenticate(async (auth) => {
        await updateSettingAction("weather_label", label, auth);
        await updateSettingAction("weather_lat", lat, auth);
        await updateSettingAction("weather_lon", lon, auth);
        return { ok: true };
      });
      if (ok) router.refresh();
    });
  };

  return (
    <div className="max-w-2xl space-y-5">
      <h2 className="text-2xl font-semibold mb-2">Weather</h2>
      <p className="text-zinc-500 text-sm">Powered by Open-Meteo (no API key). Find your latitude/longitude on Google Maps.</p>
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
      <button onClick={save} disabled={pending} className="px-6 py-3 rounded-xl bg-zinc-900 text-white font-medium">
        Save
      </button>
      {modal}
    </div>
  );
}

function DisplayTab({ settings }: { settings: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
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

  const save = () => {
    start(async () => {
      const ok = await authenticate(async (auth) => {
        await updateSettingAction("quiet_start", quietStart, auth);
        await updateSettingAction("quiet_end", quietEnd, auth);
        await updateSettingAction("chore_reset_hour", resetHour, auth);
        await updateSettingAction("idle_seconds", String(Math.max(30, Number(idleMin) * 60)), auth);
        await updateSettingAction("screensaver_mode", ssMode, auth);
        await updateSettingAction("personal_idle_seconds", String(Math.max(30, Number(personalIdleMin) * 60)), auth);
        await updateSettingAction("hijri_offset", String(Math.max(-3, Math.min(3, Number(hijriOffset) || 0))), auth);
        return { ok: true };
      });
      if (ok) router.refresh();
    });
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
      <button onClick={save} disabled={pending} className="px-6 py-3 rounded-xl bg-zinc-900 text-white font-medium">
        Save
      </button>
      {modal}
    </div>
  );
}

function GoogleTab({ members }: { members: Member[] }) {
  return (
    <div className="max-w-2xl space-y-5">
      <h2 className="text-2xl font-semibold mb-2">Google Calendar sync</h2>
      <p className="text-zinc-500">
        Link each family member to their Google account to pull events from their personal calendar.
        Events created on phones flow into zFamily automatically.
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

      <div className="mt-8 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
        <strong>Setup required:</strong> Set the env vars <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>,
        and <code>ZFAMILY_BASE_URL</code> before linking. See README for details.
      </div>
    </div>
  );
}
