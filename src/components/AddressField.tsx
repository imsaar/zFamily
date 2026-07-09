"use client";

import { useState } from "react";
import { searchAddressAction } from "@/app/actions";

/** Location input that keeps BOTH a place name/label and a resolved address:
 *  type a name (e.g. "Soccer field"), tap Look up, and pick a match — the name
 *  you typed stays, and the full address is stored/shown separately (and used
 *  for the commute estimate). */
export function AddressField({
  name,
  address,
  onNameChange,
  onAddressChange,
  placeholder = "Place name or address (optional)",
}: {
  name: string;
  address: string;
  onNameChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<Array<{ display: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const lookup = async () => {
    const q = (name.trim() || address.trim());
    if (q.length < 3) return;
    setBusy(true);
    setSearched(true);
    try {
      const r = await searchAddressAction(q);
      setResults(r.results);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => { onNameChange(e.target.value); setSearched(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookup(); } }}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-4 py-3 border border-zinc-300 rounded-xl"
        />
        <button
          onClick={lookup}
          disabled={busy || (name.trim().length < 3 && address.trim().length < 3)}
          className="px-4 py-3 rounded-xl border-2 border-zinc-300 text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {busy ? "…" : "🔎 Look up"}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="mt-2 border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => { onAddressChange(r.display); setResults([]); setSearched(false); }}
                className="w-full text-left px-3 py-2 text-sm active:bg-zinc-100"
              >
                {r.display}
              </button>
            </li>
          ))}
        </ul>
      )}

      {address && (
        <div className="mt-1.5 text-xs text-zinc-500 flex items-start gap-2">
          <span className="flex-1">📍 {address}</span>
          <button onClick={() => onAddressChange("")} className="text-zinc-400 shrink-0" aria-label="Clear address">✕ clear</button>
        </div>
      )}
      {searched && !busy && results.length === 0 && (
        <p className="mt-1 text-xs text-zinc-400">No matches — you can still just type the location.</p>
      )}
    </div>
  );
}
