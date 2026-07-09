"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Member, MemberColor, MemberRole } from "@/lib/types";
import { COLOR_CLASSES, MEMBER_COLORS, memberGlyph, displayName } from "@/lib/types";
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
  exportAllDataAction,
  importAllDataAction,
  saveBackupToDiskAction,
  listBackupsAction,
  restoreStoredBackupAction,
  checkForUpdateAction,
  runUpdateAction,
  restartAppAction,
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
import { useSettingsAuth } from "./SettingsAuth";
import { PinPadModal } from "./PinPad";
import { MemberAvatar } from "./MemberAvatar";
import { IconPicker } from "./IconPicker";
import { useConfirm } from "./ConfirmProvider";
import { CHORE_TEMPLATES, type ChoreTemplate } from "@/lib/choreTemplates";
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
  const [tab, setTab] = useState<Tab>("chores");

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
        {tab === "advanced" && <AdvancedTab settings={settings} />}
      </div>
    </div>
  );
}

function MembersTab({ members }: { members: Member[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const { authenticate, modal } = useSettingsAuth();
  const { confirm } = useConfirm();

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
                  if (!(await confirm({ title: "Delete member?", message: `Delete ${m.name} and all their data?`, confirmLabel: "Delete", danger: true }))) return;
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
  const { authenticate, modal } = useSettingsAuth();
  const { confirm } = useConfirm();
  const [showSetPin, setShowSetPin] = useState(false);
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

  // Parents can remove any member's PIN (e.g. a child who forgot theirs) — the
  // Settings screen is already parent-authorized, so no child PIN is needed.
  const removePin = async () => {
    if (!member) return;
    if (!(await confirm({ title: "Remove PIN?", message: `Remove ${displayName(member)}’s PIN?`, confirmLabel: "Remove", danger: true }))) return;
    setPinError(null);
    const ok = await authenticate((auth) => clearMemberPinAction(member.id, null, auth));
    if (ok) router.refresh();
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
          <div className="mt-1">
            <IconPicker value={emoji} onChange={setEmoji} category="member" placeholder="👧" />
          </div>
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
                onClick={() => { setPinError(null); setShowSetPin(true); }}
                className="px-4 py-2 rounded-xl border-2 border-zinc-300 text-sm"
              >
                {member.pin_hash ? "Change PIN" : "Set PIN"}
              </button>
              {member.pin_hash && (
                <button
                  onClick={removePin}
                  className="px-4 py-2 rounded-xl text-red-600 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Required for personal actions (verify, vote, redeem) and — for parents — admin actions.
              As a parent you can set or reset this PIN here without knowing the current one.
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
      {member && showSetPin && (
        <MemberPinManager
          member={member}
          error={pinError}
          onError={setPinError}
          onDone={() => {
            setShowSetPin(false);
            router.refresh();
          }}
          onCancel={() => setShowSetPin(false)}
        />
      )}
      {modal}
    </Sheet>
  );
}

function PhotoUploader({ member }: { member: Member }) {
  const router = useRouter();
  const { authenticate, modal } = useSettingsAuth();
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

// Set or change a member's PIN. Only rendered inside the parent-gated Settings
// screen, so the acting parent's authorization (from useSettingsAuth) is used —
// no need to know the member's current PIN. Just choose the new PIN twice.
function MemberPinManager({
  member,
  error,
  onError,
  onDone,
  onCancel,
}: {
  member: Member;
  error: string | null;
  onError: (e: string | null) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { authenticate } = useSettingsAuth();
  const [phase, setPhase] = useState<"new" | "confirm">("new");
  const [newPin, setNewPin] = useState<string | null>(null);

  const onSubmit = async (pin: string) => {
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
    const ok = await authenticate((auth) => setMemberPinAction(member.id, pin, null, auth));
    if (!ok) return onError("pin_invalid");
    onError(null);
    onDone();
  };

  const purposeText: Record<typeof phase, string> = {
    new: member.pin_hash ? "Choose a new 4-digit PIN" : "Choose a 4-digit PIN",
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
  const [seed, setSeed] = useState<ChoreTemplate | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const { authenticate, modal } = useSettingsAuth();
  const { confirm } = useConfirm();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Chores</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setBrowsing(true)}
            className="px-5 py-3 rounded-xl border-2 border-zinc-300 font-medium"
          >
            📋 From library
          </button>
          <button
            onClick={() => { setSeed(null); setEditing("new"); }}
            className="px-5 py-3 rounded-xl bg-zinc-900 text-white font-medium"
          >
            + Add chore
          </button>
        </div>
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
              <div className="flex flex-wrap gap-1 mt-1">
                {c.shared === 1 ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">🧹 Anyone (common)</span>
                ) : (
                  c.assignees.map((aid) => {
                    const m = members.find((mm) => mm.id === aid);
                    if (!m) return null;
                    const color = COLOR_CLASSES[m.color as MemberColor] ?? COLOR_CLASSES.sky;
                    return (
                      <span key={aid} className={`text-xs px-2 py-0.5 rounded-full ${color.bgSoft} ${color.text}`}>
                        {m.name}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
            <button onClick={() => setEditing(c)} className="px-4 py-2 rounded-lg border border-zinc-300">Edit</button>
            <button
              onClick={async () => {
                if (!(await confirm({ title: "Delete chore?", message: `Delete “${c.title}”?`, confirmLabel: "Delete", danger: true }))) return;
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

      {browsing && (
        <ChoreLibrary
          existing={chores}
          onClose={() => setBrowsing(false)}
          onPick={(t) => {
            setBrowsing(false);
            setSeed(t);
            setEditing("new");
          }}
        />
      )}
      {editing && (
        <ChoreEditor
          chore={editing === "new" ? null : editing}
          template={editing === "new" ? seed : null}
          members={members}
          onClose={() => { setEditing(null); setSeed(null); }}
        />
      )}
      {modal}
    </div>
  );
}

function ChoreLibrary({
  existing,
  onPick,
  onClose,
}: {
  existing: ChoreWithAssignees[];
  onPick: (t: ChoreTemplate) => void;
  onClose: () => void;
}) {
  const have = new Set(existing.map((c) => c.title.trim().toLowerCase()));
  return (
    <Sheet open onClose={onClose} title="Chore library" width="max-w-2xl">
      <p className="text-sm text-zinc-500 mb-4">
        Pick a common chore to start from — you&apos;ll choose who it&apos;s assigned to next.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {CHORE_TEMPLATES.map((t) => {
          const added = have.has(t.title.trim().toLowerCase());
          return (
            <button
              key={t.title}
              onClick={() => onPick(t)}
              className="flex items-center gap-3 p-3 rounded-xl border-2 border-zinc-200 text-left hover:bg-zinc-50 active:bg-zinc-100"
            >
              <div className="text-3xl w-10 text-center shrink-0">{t.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-2">
                  {t.title}
                  {added && <span className="text-xs text-emerald-600 shrink-0">✓ added</span>}
                </div>
                <div className="text-xs text-zinc-500">
                  {RECURRENCES.find(([r]) => r === t.recurrence)?.[1] ?? t.recurrence} · {t.points} pts
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function ChoreEditor({
  chore,
  template,
  members,
  onClose,
}: {
  chore: ChoreWithAssignees | null;
  template?: ChoreTemplate | null;
  members: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { authenticate, modal } = useSettingsAuth();
  const [title, setTitle] = useState(chore?.title ?? template?.title ?? "");
  const [icon, setIcon] = useState(chore?.icon ?? template?.icon ?? "📋");
  const [points, setPoints] = useState(chore?.points ?? template?.points ?? 1);
  const [recurrence, setRecurrence] = useState(chore?.recurrence ?? template?.recurrence ?? "daily");
  const [assignees, setAssignees] = useState<Set<number>>(new Set(chore?.assignees ?? []));
  const [shared, setShared] = useState(chore?.shared === 1);

  const onSave = async () => {
    if (!title.trim()) return;
    setPending(true);
    try {
      const data = {
        title: title.trim(),
        icon: icon || null,
        points,
        recurrence,
        assignees: shared ? [] : Array.from(assignees),
        shared,
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
          <IconPicker value={icon} onChange={setIcon} category="chore" placeholder="📋" />
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
            <div className="flex items-center gap-2 ml-1">
              <input
                type="number"
                min={1}
                max={999}
                value={points}
                onChange={(e) => setPoints(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                className="w-20 px-3 py-2 text-center text-lg border border-zinc-300 rounded-xl tabular-nums focus:outline-none focus:border-zinc-900"
              />
              <span className="text-sm text-zinc-500">pts</span>
            </div>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-500">Who does it</label>
          <button
            onClick={() => setShared((s) => !s)}
            className={`mt-2 w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left ${
              shared ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200"
            }`}
          >
            <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${shared ? "bg-white border-white text-zinc-900" : "border-zinc-400"}`}>
              {shared ? "✓" : ""}
            </span>
            <span>
              <span className="font-medium">🧹 Common chore — anyone can do it</span>
              <span className={`block text-xs ${shared ? "text-white/70" : "text-zinc-500"}`}>
                First person to do it completes it for everyone this {recurrence === "daily" ? "day" : "period"}.
              </span>
            </span>
          </button>
        </div>
        {!shared && (
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
                    <span>{memberGlyph(m)}</span>
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-300">Cancel</button>
          <button
            onClick={onSave}
            disabled={pending || !title.trim() || (!shared && assignees.size === 0)}
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
  const { authenticate, modal } = useSettingsAuth();
  const { confirm } = useConfirm();

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
                if (!(await confirm({ title: "Delete reward?", message: `Delete “${r.title}”?`, confirmLabel: "Delete", danger: true }))) return;
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
  const { authenticate, modal } = useSettingsAuth();
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
          <IconPicker value={icon} onChange={setIcon} category="reward" placeholder="🎁" />
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
  const { authenticate, modal } = useSettingsAuth();
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
  const { authenticate, modal } = useSettingsAuth();
  const [quietStart, setQuietStart] = useState(settings.quiet_start ?? "21:00");
  const [quietEnd, setQuietEnd] = useState(settings.quiet_end ?? "07:00");
  const [resetHour, setResetHour] = useState(settings.chore_reset_hour ?? "4");
  const [idleMin, setIdleMin] = useState(String(Math.round(Number(settings.idle_seconds ?? "300") / 60)));
  const [ssMode, setSsMode] = useState(settings.screensaver_mode ?? "clock");
  const [keyboard, setKeyboard] = useState(settings.onscreen_keyboard === "true");
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
          ["onscreen_keyboard", String(keyboard)],
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
        <label className="text-sm font-medium text-zinc-500">⌨️ On-screen keyboard</label>
        <div className="mt-2 flex gap-2">
          {([["on", true], ["off", false]] as const).map(([label, val]) => (
            <button
              key={label}
              onClick={() => setKeyboard(val)}
              className={`px-5 py-2 rounded-full border-2 ${
                keyboard === val ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200"
              }`}
            >
              {label === "on" ? "On" : "Off"}
            </button>
          ))}
        </div>
        <p className="text-sm text-zinc-500 mt-1">
          Show a tap-to-open keyboard when a text field is focused on the wall display. Turn on for touch-only kiosks without a physical keyboard.
        </p>
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
  const { authenticate, modal } = useSettingsAuth();
  const { confirm } = useConfirm();

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
                  if (!(await confirm({ title: "Remove subscription?", message: `Remove the “${f.name}” subscription and its events?`, confirmLabel: "Remove", danger: true }))) return;
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
  const { authenticate, modal } = useSettingsAuth();
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

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AdvancedTab({ settings }: { settings: Record<string, string> }) {
  const router = useRouter();
  const { authenticate, modal } = useSettingsAuth();
  const { confirm } = useConfirm();
  const [pending, setPending] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState(settings.backup_dir ?? "");
  const [autoOn, setAutoOn] = useState((settings.auto_backup ?? "true") !== "false");
  const [autoInterval, setAutoInterval] = useState(settings.auto_backup_interval ?? "weekly");
  const autoLastAt = Number(settings.auto_backup_last ?? 0);
  const [store, setStore] = useState<{ dir: string; defaultDir: string; backups: Array<{ name: string; size: number; savedAt: number }> } | null>(null);

  // ── In-app software update ──
  const [svc, setSvc] = useState(settings.update_service ?? "zfamily");
  const [upInfo, setUpInfo] = useState<{ behind?: number; current?: string; latest?: string; branch?: string; reason?: string } | null>(null);
  const [upBusy, setUpBusy] = useState(false);
  const [upOutput, setUpOutput] = useState<string>("");
  const [upDone, setUpDone] = useState(false); // build succeeded → offer restart
  const [sysPw, setSysPw] = useState("");
  const [restarting, setRestarting] = useState(false);
  const [upMsg, setUpMsg] = useState<string | null>(null);

  const checkUpdate = async () => {
    setUpMsg(null);
    setUpBusy(true);
    try {
      const holder: { v: typeof upInfo } = { v: null };
      const ok = await authenticate(async (auth) => {
        const r = await checkForUpdateAction(auth);
        if (r.ok) holder.v = { behind: r.behind, current: r.current, latest: r.latest, branch: r.branch, reason: r.reason };
        else holder.v = { reason: "reason" in r ? (r.reason as string) : "failed" };
        return { ok: true };
      });
      if (ok) setUpInfo(holder.v);
    } finally {
      setUpBusy(false);
    }
  };

  const runUpdate = async () => {
    if (!(await confirm({ title: "Update the app?", message: "This pulls the latest code and rebuilds on this device. It can take a few minutes; don’t power off. The app restarts afterward.", confirmLabel: "Update" }))) return;
    setUpMsg(null);
    setUpDone(false);
    setUpOutput("Updating… (git pull → npm install → build)");
    setUpBusy(true);
    try {
      const holder: { out: string; ok: boolean } = { out: "", ok: false };
      await authenticate(async (auth) => {
        const r = await runUpdateAction(auth);
        holder.out = "output" in r ? r.output : "Update not authorized.";
        holder.ok = !!r.ok;
        return { ok: true };
      });
      setUpOutput(holder.out || "(no output)");
      setUpDone(holder.ok);
      setUpMsg(holder.ok ? "Build complete — enter the system password to restart." : "Update failed. See the log above.");
    } finally {
      setUpBusy(false);
    }
  };

  const doRestart = async () => {
    if (!sysPw.trim()) return;
    setRestarting(true);
    setUpMsg("Restarting the app…");
    const holder = { out: "" };
    let ok = false;
    try {
      ok = await authenticate(async (auth) => {
        const r = await restartAppAction(sysPw, svc, auth);
        if (!("ok" in r) || !r.ok) holder.out = "output" in r ? r.output : "";
        return r as { ok: boolean };
      });
    } catch {
      // The server was killed by the restart mid-request — that means it worked.
      ok = true;
    } finally {
      setSysPw("");
    }
    if (ok) {
      // Give systemd a few seconds to relaunch, then reconnect.
      setTimeout(() => window.location.reload(), 7000);
    } else {
      setRestarting(false);
      setUpMsg(`Restart failed — check the system password and service name.${holder.out ? `\n${holder.out.slice(-300)}` : ""}`);
    }
  };

  const saveAuto = async () => {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const ok = await authenticate(async (auth) => {
        let r = await updateSettingAction("auto_backup", String(autoOn), auth);
        if (!r.ok) return r;
        r = await updateSettingAction("auto_backup_interval", autoInterval, auth);
        return r;
      });
      if (ok) setBackupMsg(autoOn ? `Auto-backup on — ${autoInterval}.` : "Auto-backup off.");
    } finally {
      setBackupBusy(false);
    }
  };

  const loadBackups = async () => {
    const holder: { v: typeof store } = { v: null };
    await authenticate(async (auth) => {
      const r = await listBackupsAction(auth);
      if (r.ok) holder.v = { dir: r.dir, defaultDir: r.defaultDir, backups: r.backups };
      return r;
    });
    if (holder.v) setStore(holder.v);
  };

  useEffect(() => {
    void loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePath = async () => {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const ok = await authenticate((auth) => updateSettingAction("backup_dir", pathInput.trim(), auth));
      if (ok) {
        await loadBackups();
        setBackupMsg("Backup location saved.");
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const saveToDisk = async () => {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const holder: { v: { name: string; path: string; bytes: number } | null } = { v: null };
      const ok = await authenticate(async (auth) => {
        const r = await saveBackupToDiskAction(auth);
        if (r.ok) holder.v = { name: r.name, path: r.path, bytes: r.bytes };
        return r;
      });
      if (ok && holder.v) {
        setBackupMsg(`Saved ${holder.v.name} (${fmtBytes(holder.v.bytes)}) → ${holder.v.path}`);
        await loadBackups();
      } else {
        setBackupMsg("Couldn’t save backup — check the backup location exists and is writable.");
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreStored = async (name: string) => {
    if (!(await confirm({ title: "Restore this backup?", message: `“${name}” will REPLACE all current data. This cannot be undone.`, confirmLabel: "Restore", danger: true }))) return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const ok = await authenticate((auth) => restoreStoredBackupAction(name, auth));
      if (ok) {
        setBackupMsg("Restored — reloading…");
        window.location.href = "/";
      } else {
        setBackupMsg("Restore failed — that backup couldn’t be read.");
        setBackupBusy(false);
      }
    } catch {
      setBackupBusy(false);
    }
  };

  const exportData = async () => {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      let backup: unknown = null;
      const ok = await authenticate(async (auth) => {
        const r = await exportAllDataAction(auth);
        if (r.ok) backup = r.backup;
        return r;
      });
      if (ok && backup) {
        const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `zfamily-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setBackupMsg("Backup downloaded.");
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const importData = async (file: File | null) => {
    if (!file) return;
    setBackupMsg(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setBackupMsg("That file isn’t a valid backup (couldn’t read JSON).");
      return;
    }
    if (!(await confirm({ title: "Restore from backup?", message: "This REPLACES all current data with the backup. This cannot be undone.", confirmLabel: "Restore", danger: true }))) return;
    setBackupBusy(true);
    try {
      const ok = await authenticate((auth) => importAllDataAction(parsed, auth));
      if (ok) {
        setBackupMsg("Restored — reloading…");
        window.location.href = "/";
      } else {
        setBackupMsg("Restore failed — that file may not be a zFamily backup.");
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const reset = async () => {
    if (!(await confirm({
      title: "Factory reset?",
      message: "This erases ALL data — family members, chores, meal plans, rewards, PINs, and settings. This cannot be undone.",
      confirmLabel: "Continue",
      danger: true,
    }))) return;
    if (!(await confirm({
      title: "Are you absolutely sure?",
      message: "The app will restart from the first-run family setup.",
      confirmLabel: "Erase everything",
      danger: true,
    }))) return;
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

      <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6 mb-6">
        <h3 className="text-lg font-semibold">💾 Backup &amp; restore</h3>
        <p className="text-sm text-zinc-600 mt-2 mb-5">
          Download a single file containing <span className="font-medium">all</span> data — family members and photos,
          chores and completions, calendar events, meal plans and shopping, rewards, PINs, and settings. Keep it
          somewhere safe; restoring replaces everything currently on this device.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportData}
            disabled={backupBusy}
            className="px-6 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-50"
          >
            {backupBusy ? "Working…" : "⬇️ Export backup"}
          </button>
          <label
            className={`px-6 py-3 rounded-xl border-2 border-zinc-300 font-medium cursor-pointer ${
              backupBusy ? "opacity-50 pointer-events-none" : "active:bg-zinc-50"
            }`}
          >
            ⬆️ Restore from backup
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              disabled={backupBusy}
              onChange={(e) => {
                importData(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {backupMsg && <p className="text-sm text-zinc-600 mt-3 break-words">{backupMsg}</p>}
        <p className="text-xs text-zinc-400 mt-3">
          The backup file contains PINs and linked-account tokens — treat it like a password.
        </p>

        <div className="mt-6 pt-6 border-t border-zinc-200">
          <div className="text-sm font-medium text-zinc-700">Save backups on this device</div>
          <p className="text-xs text-zinc-500 mt-1 mb-3">
            Backups are written to this folder on the device. Leave blank to use the default
            {store ? <> (<code className="text-zinc-600">{store.defaultDir}</code>)</> : " (a “backups” folder in the data directory)"}.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder={store?.defaultDir ?? "/var/lib/zfamily/backups"}
              className="flex-1 min-w-[240px] px-4 py-2.5 border border-zinc-300 rounded-xl text-sm"
            />
            <button onClick={savePath} disabled={backupBusy} className="px-4 py-2.5 rounded-xl border-2 border-zinc-300 text-sm font-medium disabled:opacity-50">
              Save location
            </button>
            <button onClick={saveToDisk} disabled={backupBusy} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium disabled:opacity-50">
              💾 Save backup now
            </button>
          </div>
          {store && store.dir !== (pathInput.trim() || store.defaultDir) && (
            <p className="text-xs text-amber-600 mt-2">Unsaved location change — tap “Save location” to apply.</p>
          )}

          <div className="mt-5 rounded-xl bg-zinc-50 border border-zinc-200 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-medium">🔁 Automatic backup</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Periodically save a backup to the folder above.
                  {autoLastAt > 0 && <> Last: {new Date(autoLastAt * 1000).toLocaleString()}.</>}
                </div>
              </div>
              <div className="flex gap-2">
                {([["on", true], ["off", false]] as const).map(([label, val]) => (
                  <button
                    key={label}
                    onClick={() => setAutoOn(val)}
                    className={`px-4 py-1.5 rounded-full border-2 text-sm ${autoOn === val ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200"}`}
                  >
                    {label === "on" ? "On" : "Off"}
                  </button>
                ))}
              </div>
            </div>
            {autoOn && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-zinc-600">Every</span>
                {(["daily", "weekly", "monthly"] as const).map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setAutoInterval(iv)}
                    className={`px-4 py-1.5 rounded-full border-2 text-sm capitalize ${autoInterval === iv ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200"}`}
                  >
                    {iv === "daily" ? "Day" : iv === "weekly" ? "Week" : "Month"}
                  </button>
                ))}
              </div>
            )}
            <button onClick={saveAuto} disabled={backupBusy} className="mt-3 px-4 py-2 rounded-xl border-2 border-zinc-300 text-sm font-medium disabled:opacity-50">
              Save auto-backup settings
            </button>
          </div>

          {store && store.backups.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Stored backups ({store.backups.length})</div>
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {store.backups.map((b) => (
                  <li key={b.name} className="flex items-center gap-3 text-sm rounded-lg border border-zinc-200 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{b.name}</div>
                      <div className="text-xs text-zinc-500 tabular-nums">
                        {new Date(b.savedAt * 1000).toLocaleString()} · {fmtBytes(b.size)}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreStored(b.name)}
                      disabled={backupBusy}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-300 text-sm disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-zinc-200 bg-white p-6 mb-6">
        <h3 className="text-lg font-semibold">⬆️ Software update</h3>
        <p className="text-sm text-zinc-600 mt-2 mb-4">
          Pull the latest code and rebuild on this device, then restart to apply. Requires a git‑based install
          (see the README). The build can take a few minutes.
        </p>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <button onClick={checkUpdate} disabled={upBusy || restarting} className="px-4 py-2.5 rounded-xl border-2 border-zinc-300 text-sm font-medium disabled:opacity-50">
            {upBusy ? "Working…" : "Check for updates"}
          </button>
          <button onClick={runUpdate} disabled={upBusy || restarting} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium disabled:opacity-50">
            ⬆️ Update now
          </button>
        </div>

        {upInfo && (
          <div className="text-sm mb-3">
            {upInfo.reason && upInfo.reason !== "no_upstream" ? (
              <span className="text-amber-600 whitespace-pre-wrap break-words">{upInfo.reason}</span>
            ) : upInfo.reason === "no_upstream" ? (
              <span className="text-zinc-600">On <code>{upInfo.branch}</code> — no upstream branch to compare against.</span>
            ) : (upInfo.behind ?? 0) > 0 ? (
              <span className="text-zinc-800">🔔 {upInfo.behind} update{upInfo.behind === 1 ? "" : "s"} available on <code>{upInfo.branch}</code>. Latest: {upInfo.latest}</span>
            ) : (
              <span className="text-emerald-600">✓ Up to date ({upInfo.branch}). {upInfo.current}</span>
            )}
          </div>
        )}

        {upOutput && (
          <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-xl p-3 max-h-64 overflow-auto whitespace-pre-wrap">{upOutput}</pre>
        )}

        {upDone && (
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <input
              type="password"
              value={sysPw}
              onChange={(e) => setSysPw(e.target.value)}
              placeholder="System password"
              className="px-4 py-2.5 border border-zinc-300 rounded-xl text-sm min-w-[200px]"
            />
            <button
              onClick={doRestart}
              disabled={restarting || !sysPw.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {restarting ? "Restarting…" : "Restart & apply"}
            </button>
            <span className="text-xs text-zinc-400">Piped to sudo, never stored.</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-zinc-500">systemd service</span>
          <input
            value={svc}
            onChange={(e) => setSvc(e.target.value)}
            onBlur={() => { if ((settings.update_service ?? "zfamily") !== svc.trim()) void authenticate((auth) => updateSettingAction("update_service", svc.trim(), auth)); }}
            className="w-40 px-3 py-1.5 border border-zinc-300 rounded-lg text-sm"
          />
        </div>

        {upMsg && <p className="text-sm text-zinc-600 mt-3 whitespace-pre-wrap break-words">{upMsg}</p>}
      </div>

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
