"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import type { EventRow, Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";
import type { WeatherSnapshot } from "@/lib/weather";

// If someone interacts during quiet hours, keep the display awake for this long
// after their last touch before the quiet-hours blackout returns.
const QUIET_WAKE_SECONDS = 5 * 60;

function parseHM(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map((s) => parseInt(s, 10));
  return { h: h || 0, m: m || 0 };
}

function inQuietWindow(now: Date, start: string, end: string): boolean {
  const s = parseHM(start);
  const e = parseHM(end);
  const cur = now.getHours() * 60 + now.getMinutes();
  const sMin = s.h * 60 + s.m;
  const eMin = e.h * 60 + e.m;
  if (sMin === eMin) return false;
  if (sMin < eMin) return cur >= sMin && cur < eMin;
  // wraps midnight
  return cur >= sMin || cur < eMin;
}

export function Screensaver({
  weather,
  upcomingEvents,
  members,
  quietStart,
  quietEnd,
  idleSeconds,
  mode,
}: {
  weather: WeatherSnapshot | null;
  upcomingEvents: EventRow[];
  members: Member[];
  quietStart: string;
  quietEnd: string;
  idleSeconds: number;
  mode: string;
}) {
  const [active, setActive] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const lastActivityRef = useRef(Date.now());

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now();
      if (active) setActive(false);
    };
    const evts: Array<keyof WindowEventMap> = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
    ];
    for (const e of evts) window.addEventListener(e, bump, { passive: true });
    return () => {
      for (const e of evts) window.removeEventListener(e, bump);
    };
  }, [active]);

  useEffect(() => {
    const check = setInterval(() => {
      const idle = (Date.now() - lastActivityRef.current) / 1000;
      const now = new Date();
      const quiet = inQuietWindow(now, quietStart, quietEnd);
      // During quiet hours a recent interaction suspends the blackout for
      // QUIET_WAKE_SECONDS from the last touch; otherwise the normal idle
      // timeout applies.
      const shouldActivate = quiet ? idle >= QUIET_WAKE_SECONDS : idle >= idleSeconds;
      if (shouldActivate !== active) setActive(shouldActivate);
    }, 5000);
    return () => clearInterval(check);
  }, [active, idleSeconds, quietStart, quietEnd]);

  if (!active || !now) return null;

  const inQuiet = inQuietWindow(now, quietStart, quietEnd);
  const next = upcomingEvents[0];
  const nextMember = next?.member_id ? memberById.get(next.member_id) : null;
  const nextColor = nextMember ? COLOR_CLASSES[nextMember.color as MemberColor] : null;

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center fade-in ${
        inQuiet ? "bg-black text-white" : "bg-zinc-950/95 text-white"
      }`}
      onClick={() => {
        lastActivityRef.current = Date.now();
        setActive(false);
      }}
    >
      <div className="text-center leading-none">
        <div className="text-[11rem] font-light tabular-nums tracking-tight">
          {format(now, "h:mm")}
          <span className="text-6xl align-top ml-2 opacity-70">{format(now, "a")}</span>
        </div>
        <div className="text-3xl mt-2 opacity-70">{format(now, "EEEE, MMMM d")}</div>
      </div>

      {mode !== "clock" || weather || next ? (
        <div className="mt-12 flex items-center gap-16">
          {weather && (
            <div className="flex items-center gap-4">
              <div className="text-7xl">{weather.conditionIcon}</div>
              <div>
                <div className="text-5xl font-light tabular-nums">{weather.currentTempF}°</div>
                <div className="text-xl opacity-70">{weather.currentCondition}</div>
              </div>
            </div>
          )}

          {next && (
            <div className="max-w-lg">
              <div className="text-sm uppercase tracking-widest opacity-50">Coming up</div>
              <div className="mt-1 flex items-center gap-3">
                {nextColor && <div className={`w-3 h-3 rounded-full ${nextColor.dot}`} />}
                <div className="text-2xl font-medium truncate">{next.title}</div>
              </div>
              <div className="text-lg opacity-70 tabular-nums">
                {next.all_day ? "All day" : format(new Date(next.start_ts * 1000), "h:mm a")}
                {nextMember ? ` · ${nextMember.name}` : ""}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {!inQuiet && weather && (weather.hourly.length > 0 || weather.forecast.length > 0) && (
        <div className="mt-12 w-full max-w-6xl px-8 space-y-8">
          {weather.hourly.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest opacity-40 mb-3 text-center">Today, hourly</div>
              <div className="flex justify-center gap-6">
                {weather.hourly.map((h) => (
                  <div key={h.time} className="flex flex-col items-center gap-1">
                    <div className="text-sm opacity-60 tabular-nums">{format(new Date(h.time), "h a")}</div>
                    <div className="text-3xl">{h.icon}</div>
                    <div className="text-xl tabular-nums">{h.tempF}°</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {weather.forecast.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest opacity-40 mb-3 text-center">Next 7 days</div>
              <div className="flex justify-center gap-8">
                {weather.forecast.slice(0, 7).map((d, i) => (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div className="text-sm opacity-60">{i === 0 ? "Today" : format(new Date(`${d.date}T12:00:00`), "EEE")}</div>
                    <div className="text-4xl">{d.icon}</div>
                    <div className="text-lg tabular-nums">
                      <span className="font-medium">{d.highF}°</span> <span className="opacity-50">{d.lowF}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-8 text-sm opacity-40">
        {inQuiet ? "Quiet hours · Tap to wake" : "Tap anywhere to resume"}
      </div>
    </div>
  );
}
