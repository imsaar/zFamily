"use client";

import { useState } from "react";

/* ─── Curated emoji library ──────────────────────────────────────────
 * Grouped so the picker can lead with the section most relevant to what
 * is being edited (a meal → Food first, a chore → Household first, …),
 * while still exposing the full library to choose from. A small free-text
 * box below the grid keeps "paste any emoji" working for power users.
 */

export type IconCategory = "meal" | "chore" | "reward" | "member";

type Section = { label: string; emojis: string[] };

const SECTIONS: Section[] = [
  {
    label: "Food",
    emojis: [
      "🍽️", "🥣", "🥪", "🍕", "🍔", "🌮", "🌯", "🍜", "🍲", "🥗", "🍳", "🥞",
      "🧇", "🐟", "🍗", "🍖", "🥩", "🍝", "🍛", "🍚", "🍱", "🥡", "🌭", "🥙",
      "🧆", "🥘", "🫕", "🥐", "🥖", "🧀", "🥚", "🥑", "🥦", "🥕", "🌽", "🍎",
      "🍌", "🍓", "🍇", "🍉", "🫐", "🍰", "🧁", "🍪", "🍩", "🍨", "🍦", "🍿",
      "☕", "🧃", "🥛",
    ],
  },
  {
    label: "Household",
    emojis: [
      "📋", "🧹", "🧽", "🧼", "🧴", "🪣", "🧺", "🗑️", "♻️", "🚮", "🛏️", "🛋️",
      "🚿", "🛁", "🚽", "🪥", "🧻", "🪴", "🌱", "💧", "🔌", "💡", "🧯", "🔧",
      "🔨", "🪚", "🧰", "🚗", "🚙", "🛒", "👕", "👚", "🧦", "👟", "🎒", "📦",
      "📮", "🔑", "🕯️", "🪞",
    ],
  },
  {
    label: "People & Pets",
    emojis: [
      "🙂", "😀", "😄", "😎", "🤓", "🥳", "😇", "🤗", "😴", "🤠", "👶", "🧒",
      "👦", "👧", "🧑", "👩", "👨", "👵", "👴", "👩‍🦰", "👨‍🦰", "🧕", "👳", "👮",
      "👨‍🍳", "👩‍🍳", "👨‍🌾", "👩‍🌾", "🐶", "🐱", "🐰", "🐹", "🐣", "🐦", "🐢", "🐠",
      "🦄", "🐝", "🦊", "🐼",
    ],
  },
  {
    label: "Rewards & Fun",
    emojis: [
      "🎁", "🏆", "🥇", "🎖️", "🌟", "⭐", "✨", "💎", "🎉", "🎊", "🎈", "🎮",
      "🕹️", "🎲", "🧩", "🎯", "🎨", "🎬", "🍿", "🎵", "🎧", "📱", "💻", "📺",
      "🏕️", "🏖️", "🎡", "🎢", "🛝", "⚽", "🏀", "🏈", "🎾", "🚲", "🛼", "🛹",
      "🏊", "🚀", "🌈", "🍭",
    ],
  },
  {
    label: "Nature & Time",
    emojis: [
      "☀️", "🌙", "⭐", "🌤️", "⛅", "🌧️", "❄️", "🔥", "🌸", "🌻", "🌳", "🍂",
      "🌍", "📅", "🗓️", "⏰", "⏳", "🔔", "❤️", "💛", "💚", "💙", "💜", "🧡",
    ],
  },
];

// Which section a given editing context should surface first.
const CATEGORY_ORDER: Record<IconCategory, string[]> = {
  meal: ["Food", "Household", "Rewards & Fun", "People & Pets", "Nature & Time"],
  chore: ["Household", "Food", "Nature & Time", "People & Pets", "Rewards & Fun"],
  reward: ["Rewards & Fun", "Food", "People & Pets", "Household", "Nature & Time"],
  member: ["People & Pets", "Rewards & Fun", "Nature & Time", "Food", "Household"],
};

export function IconPicker({
  value,
  onChange,
  category = "member",
  placeholder = "🙂",
}: {
  value: string | null;
  onChange: (v: string) => void;
  category?: IconCategory;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const order = CATEGORY_ORDER[category];
  const sections = [...SECTIONS].sort(
    (a, b) => order.indexOf(a.label) - order.indexOf(b.label)
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Choose an icon"
        className="w-20 h-[54px] shrink-0 flex items-center justify-center text-2xl border border-zinc-300 rounded-xl bg-white active:bg-zinc-100"
      >
        {value || <span className="text-zinc-300">{placeholder}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 fade-in" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-6 max-h-[80vh] flex flex-col overflow-hidden fade-in">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{value || placeholder}</span>
                <div className="text-lg font-semibold">Choose an icon</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-11 h-11 rounded-full text-3xl text-zinc-500 hover:bg-zinc-100 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              {sections.map((s) => (
                <div key={s.label} className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2 px-1">{s.label}</div>
                  <div className="grid grid-cols-8 gap-1.5">
                    {s.emojis.map((e) => (
                      <button
                        key={e}
                        onClick={() => {
                          onChange(e);
                          setOpen(false);
                        }}
                        className={`h-11 rounded-xl text-2xl flex items-center justify-center active:scale-95 transition-transform ${
                          value === e ? "bg-zinc-900" : "hover:bg-zinc-100"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-zinc-200 flex items-center gap-3 shrink-0">
              <label className="text-sm text-zinc-500 whitespace-nowrap">Or type your own</label>
              <input
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                maxLength={4}
                placeholder={placeholder}
                className="w-20 px-3 py-2 text-center text-2xl border border-zinc-300 rounded-xl"
              />
              <button
                onClick={() => setOpen(false)}
                className="ml-auto px-5 py-2 rounded-xl bg-zinc-900 text-white font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
