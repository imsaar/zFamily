"use client";

import { useEffect, useState } from "react";

function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="w-64 h-14" />;
  return (
    <div className="flex flex-col items-start leading-tight">
      <div className="text-4xl font-semibold tabular-nums tracking-tight">{fmtTime(now)}</div>
      <div className="text-base text-zinc-500">{fmtDate(now)}</div>
    </div>
  );
}
