import Link from "next/link";
import { Clock } from "./Clock";
import type { Member, MemberColor } from "@/lib/types";
import { COLOR_CLASSES } from "@/lib/types";
import type { WeatherSnapshot } from "@/lib/weather";

export function Header({
  members,
  weather,
}: {
  members: Member[];
  weather: WeatherSnapshot | null;
}) {
  return (
    <header className="h-24 px-8 border-b border-zinc-200 bg-white/80 backdrop-blur flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-8">
        <Clock />
      </div>

      <div className="flex items-center gap-3">
        {members.map((m) => (
          <MemberAvatar key={m.id} member={m} />
        ))}
      </div>

      <div className="flex items-center gap-4">
        {weather ? (
          <div className="flex items-center gap-4">
            <div className="text-5xl leading-none">{weather.conditionIcon}</div>
            <div className="leading-tight">
              <div className="text-3xl font-semibold tabular-nums">{weather.currentTempF}°</div>
              <div className="text-sm text-zinc-500">
                {weather.label} · H {weather.highF}° / L {weather.lowF}°
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-400">Weather offline</div>
        )}
      </div>
    </header>
  );
}

function MemberAvatar({ member }: { member: Member }) {
  const color = COLOR_CLASSES[member.color as MemberColor] ?? COLOR_CLASSES.sky;
  const initial = (member.name[0] ?? "?").toUpperCase();
  return (
    <Link href={`/me/${member.id}`} className="flex flex-col items-center gap-1 active:opacity-80">
      <div
        className={`w-14 h-14 rounded-full ${color.bg} flex items-center justify-center text-2xl text-white shadow-sm`}
        title={`Open ${member.name}'s view`}
      >
        {member.emoji ?? initial}
      </div>
      <div className="text-xs text-zinc-600 max-w-16 truncate">{member.name}</div>
    </Link>
  );
}
