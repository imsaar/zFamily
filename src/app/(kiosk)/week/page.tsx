import { WeekView } from "@/components/WeekView";
import { TodaySidebar } from "@/components/TodaySidebar";
import { listMembers } from "@/lib/members";
import { listEventsInRange, expandRecurrences } from "@/lib/events";
import { listChores, getCompletions, isDueOn, streakFor, eligibleVerifiers } from "@/lib/chores";
import { weekRange, weekDays, parseDateParam } from "@/lib/dates";
import { format } from "date-fns";
import type { ChoreCompletion } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const dateStr = typeof sp.d === "string" ? sp.d : null;
  const anchor = parseDateParam(dateStr);

  const { start, end } = weekRange(anchor, 0);
  const days = weekDays(anchor, 0);

  const members = listMembers();
  const rawEvents = listEventsInRange(
    Math.floor(start.getTime() / 1000),
    Math.floor(end.getTime() / 1000) + 86400
  );
  const templates = listEventsInRange(0, Math.floor(start.getTime() / 1000)).filter((e) => e.rrule);
  const events = expandRecurrences(
    [...rawEvents, ...templates],
    Math.floor(start.getTime() / 1000),
    Math.floor(end.getTime() / 1000) + 86400
  );

  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");
  const allChores = listChores();
  const todayChores = allChores.filter((c) => isDueOn(c, today));

  const compsByMember = new Map<number, ChoreCompletion[]>();
  const streaks = new Map<number, number>();
  const eligibleByCompletion = new Map<number, number[]>();
  for (const m of members) {
    const comps = getCompletions(m.id, today, today);
    compsByMember.set(m.id, comps);
    streaks.set(m.id, streakFor(m.id, allChores, today));
    for (const c of comps) {
      if (!c.verified_at) eligibleByCompletion.set(c.id, eligibleVerifiers(c));
    }
  }

  const todayEvents = events.filter((e) => format(new Date(e.start_ts * 1000), "yyyy-MM-dd") === todayKey);

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0">
        <WeekView days={days} members={members} events={events} anchor={anchor} />
      </div>
      <TodaySidebar
        members={members}
        chores={todayChores}
        completionsByMember={compsByMember}
        eligibleByCompletion={eligibleByCompletion}
        streaks={streaks}
        events={todayEvents}
      />
    </div>
  );
}
