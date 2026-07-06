import Link from "next/link";
import { Clock } from "./Clock";
import type { Member } from "@/lib/types";
import { displayName } from "@/lib/types";
import { MemberAvatar } from "./MemberAvatar";
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
          <MemberBadge key={m.id} member={m} />
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

function MemberBadge({ member }: { member: Member }) {
  const label = displayName(member);
  return (
    <Link href={`/me/${member.id}`} className="flex flex-col items-center gap-1 active:opacity-80">
      <MemberAvatar
        member={member}
        className="w-14 h-14 rounded-full shadow-sm"
        textClass="text-2xl"
      />
      <div className="text-xs text-zinc-600 max-w-16 truncate" title={`Open ${label}'s view`}>{label}</div>
    </Link>
  );
}
