import { MonthView } from "@/components/MonthView";
import { listMembers } from "@/lib/members";
import { listEventsInRange, expandRecurrences } from "@/lib/events";
import { monthGrid, parseDateParam } from "@/lib/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function MonthPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const anchor = parseDateParam(typeof sp.d === "string" ? sp.d : null);
  const days = monthGrid(anchor, 0);
  const start = days[0];
  const end = days[days.length - 1];
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
  const members = listMembers();
  return <MonthView days={days} members={members} events={events} anchor={anchor} />;
}
