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
    <header className="h-16 lg:h-24 px-3 lg:px-8 border-b border-zinc-200 bg-white/80 backdrop-blur flex items-center justify-between gap-2 lg:gap-8 shrink-0">
      <div className="flex items-center gap-8 shrink-0">
        <Clock />
      </div>

      <div className="flex items-center gap-2 lg:gap-3 min-w-0 overflow-x-auto no-scrollbar">
        {members.map((m) => (
          <MemberBadge key={m.id} member={m} />
        ))}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {weather ? (
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="text-2xl lg:text-5xl leading-none">{weather.conditionIcon}</div>
            <div className="leading-tight">
              <div className="text-xl lg:text-3xl font-semibold tabular-nums">{weather.currentTempF}°</div>
              <div className="hidden sm:block text-sm text-zinc-500">
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
    <Link href={`/me/${member.id}`} className="flex flex-col items-center gap-1 active:opacity-80 shrink-0">
      <MemberAvatar
        member={member}
        className="w-9 h-9 lg:w-14 lg:h-14 rounded-full shadow-sm"
        textClass="text-base lg:text-2xl"
      />
      <div className="hidden lg:block text-xs text-zinc-600 max-w-16 truncate" title={`Open ${label}'s view`}>{label}</div>
    </Link>
  );
}
