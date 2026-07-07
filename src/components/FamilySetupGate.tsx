"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberColor, MemberRole } from "@/lib/types";
import { COLOR_CLASSES, MEMBER_COLORS } from "@/lib/types";
import type { GeocodeResult } from "@/lib/geocode";
import { completeFamilySetupAction, searchCityAction } from "@/app/actions";
import { IconPicker } from "./IconPicker";

type Draft = {
  key: number;
  name: string;
  nickname: string;
  emoji: string;
  color: MemberColor;
  role: MemberRole;
};

let nextKey = 1;
function blankMember(role: MemberRole, i: number): Draft {
  return { key: nextKey++, name: "", nickname: "", emoji: "", color: MEMBER_COLORS[i % MEMBER_COLORS.length], role };
}

/** Full-screen first-run wizard shown when no family exists yet. Builds the
 *  family (members + optional location) and hands off to the PIN setup gate. */
export function FamilySetupGate() {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "members" | "location">("welcome");
  const [members, setMembers] = useState<Draft[]>([
    blankMember("parent", 0),
    blankMember("child", 2),
  ]);
  const [weather, setWeather] = useState<{ label: string; lat: string; lon: string; tz: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const named = members.filter((m) => m.name.trim());
  const hasParent = named.some((m) => m.role === "parent");
  const canContinueMembers = named.length > 0 && hasParent;

  const patch = (key: number, p: Partial<Draft>) =>
    setMembers((ms) => ms.map((m) => (m.key === key ? { ...m, ...p } : m)));

  const finish = async () => {
    setPending(true);
    setError(null);
    try {
      const r = await completeFamilySetupAction({
        members: named.map((m) => ({ name: m.name, nickname: m.nickname || null, emoji: m.emoji || null, color: m.color, role: m.role })),
        weather,
      });
      if (!r.ok) {
        setError(
          r.reason === "need_parent"
            ? "Add at least one parent before finishing."
            : r.reason === "already_setup"
            ? "A family already exists on this device."
            : "Add at least one family member."
        );
        setPending(false);
        return;
      }
      // Members now exist → the PIN setup gate takes over after refresh.
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] bg-white flex flex-col items-center overflow-y-auto p-10">
      <div className="w-full max-w-3xl my-auto">
        {step === "welcome" && (
          <div className="text-center">
            <div className="text-6xl mb-6">🏡</div>
            <h1 className="text-5xl font-semibold mb-4">Welcome to zFamily</h1>
            <p className="text-xl text-zinc-600 mb-10 max-w-xl mx-auto">
              Let’s set up your household. It only takes a minute — add everyone in the
              family, pick your location for weather, and you’re ready to go.
            </p>
            <button
              onClick={() => setStep("members")}
              className="px-8 py-4 rounded-2xl bg-zinc-900 text-white text-xl font-medium"
            >
              Get started
            </button>
          </div>
        )}

        {step === "members" && (
          <div>
            <StepHeader n={1} total={2} title="Who’s in the family?" />
            <p className="text-zinc-600 mb-6">
              Add each family member. Parents verify chores and manage settings; children
              earn points. You’ll set a PIN for each parent next.
            </p>
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.key} className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center gap-3">
                  <IconPicker
                    value={m.emoji}
                    onChange={(v) => patch(m.key, { emoji: v })}
                    category="member"
                    placeholder="🙂"
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <input
                      value={m.name}
                      onChange={(e) => patch(m.key, { name: e.target.value })}
                      placeholder="First name"
                      className="w-full px-4 py-3 text-lg border border-zinc-300 rounded-xl"
                    />
                    <input
                      value={m.nickname}
                      onChange={(e) => patch(m.key, { nickname: e.target.value })}
                      placeholder="Nickname (optional)"
                      className="w-full px-4 py-2 text-sm border border-zinc-200 rounded-xl"
                    />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(["parent", "child"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => patch(m.key, { role: r })}
                        className={`px-4 py-2 rounded-full border-2 text-sm ${
                          m.role === r ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200 text-zinc-600"
                        }`}
                      >
                        {r === "parent" ? "Parent" : "Child"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {MEMBER_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => patch(m.key, { color: c })}
                        aria-label={c}
                        className={`w-7 h-7 rounded-full ${COLOR_CLASSES[c].bg} ${
                          m.color === c ? "ring-2 ring-offset-2 ring-zinc-900" : ""
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setMembers((ms) => (ms.length > 1 ? ms.filter((x) => x.key !== m.key) : ms))}
                    disabled={members.length <= 1}
                    className="px-2 py-2 rounded-lg text-red-600 disabled:opacity-30 shrink-0"
                    aria-label="Remove"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setMembers((ms) => [...ms, blankMember("child", ms.length)])}
              className="mt-4 px-5 py-3 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-600 font-medium w-full"
            >
              + Add another family member
            </button>

            {!canContinueMembers && (
              <p className="mt-4 text-sm text-amber-600">
                Add at least one named member, including one parent.
              </p>
            )}
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep("welcome")} className="px-6 py-3 rounded-xl border border-zinc-300">
                Back
              </button>
              <button
                onClick={() => setStep("location")}
                disabled={!canContinueMembers}
                className="px-8 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "location" && (
          <div>
            <StepHeader n={2} total={2} title="Where are you?" />
            <p className="text-zinc-600 mb-6">
              Pick your city so the wall display can show local weather and use the right
              timezone. You can skip this and set it later in Settings.
            </p>
            <LocationPicker selected={weather} onSelect={setWeather} />

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep("members")} className="px-6 py-3 rounded-xl border border-zinc-300">
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => { setWeather(null); finish(); }}
                  disabled={pending}
                  className="px-6 py-3 rounded-xl border border-zinc-300 disabled:opacity-40"
                >
                  Skip
                </button>
                <button
                  onClick={finish}
                  disabled={pending}
                  className="px-8 py-3 rounded-xl bg-zinc-900 text-white font-medium disabled:opacity-40"
                >
                  {pending ? "Setting up…" : "Finish setup"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeader({ n, total, title }: { n: number; total: number; title: string }) {
  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-zinc-400">Step {n} of {total}</div>
      <h1 className="text-4xl font-semibold mt-1">{title}</h1>
    </div>
  );
}

function LocationPicker({
  selected,
  onSelect,
}: {
  selected: { label: string; lat: string; lon: string; tz: string } | null;
  onSelect: (w: { label: string; lat: string; lon: string; tz: string } | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

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
    const label = [r.name, r.admin1, r.countryCode].filter(Boolean).join(", ");
    onSelect({ label, lat: r.latitude.toFixed(4), lon: r.longitude.toFixed(4), tz: r.timezone });
    setResults([]);
    setQuery("");
  };

  return (
    <div>
      {selected && (
        <div className="mb-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div>
            <div className="font-medium text-emerald-900">📍 {selected.label}</div>
            <div className="text-xs text-emerald-700 tabular-nums">
              {selected.lat}, {selected.lon} · {selected.tz}
            </div>
          </div>
          <button onClick={() => onSelect(null)} className="text-sm text-emerald-800 underline">
            Change
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search a city, e.g. Austin, Texas"
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
              <button onClick={() => pick(r)} className="w-full text-left px-4 py-3 active:bg-zinc-100">
                <div className="font-medium">
                  {r.name}
                  {r.admin1 ? `, ${r.admin1}` : ""}
                  {r.country ? ` · ${r.country}` : ""}
                </div>
                <div className="text-xs text-zinc-500 tabular-nums">
                  {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)} · {r.timezone}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
