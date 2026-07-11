"use client";

export type TransportMode = "car" | "bus";

/** Segmented toggle for how you'll get to an event's location. Car is the
 *  default; picking Bus makes the commute estimate use a transit approximation.
 *  Show it only when the event has a location worth routing to. */
export function TransportModePicker({
  value,
  onChange,
}: {
  value: TransportMode;
  onChange: (m: TransportMode) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-sm text-zinc-500">Get there by</span>
      <div className="flex rounded-full border-2 border-zinc-200 overflow-hidden">
        {(
          [
            ["car", "🚗 Car"],
            ["bus", "🚌 Bus"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={`px-4 py-2 text-sm ${value === m ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
