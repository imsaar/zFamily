import { FamilyHome } from "@/components/FamilyHome";
import { listMembers } from "@/lib/members";
import { listEventsInRange } from "@/lib/events";
import { listChores, getCompletions, isDueOn, listPendingCompletions } from "@/lib/chores";
import { listProposals, nextWeekStart, listPlanForRange, getMeal } from "@/lib/meals";
import type { Meal, MealSlot } from "@/lib/meals";
import { verseOfDay } from "@/lib/verses";
import { toHijri } from "@/lib/hijri";
import { getAllSettings } from "@/lib/settings";
import { addDays, startOfWeek, format } from "date-fns";

export const dynamic = "force-dynamic";

export default function FamilyHomePage() {
  const now = new Date();
  const members = listMembers();
  const allChores = listChores();
  const today = now;

  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const rangeStart = Math.floor(weekStart.getTime() / 1000);
  const rangeEnd = Math.floor(addDays(weekStart, 7).getTime() / 1000);
  const weekEvents = listEventsInRange(rangeStart, rangeEnd);

  // Per-day events grouped
  const eventsByDay = new Map<string, number>();
  const eventsByDayMembers = new Map<string, Set<number>>();
  for (const d of days) {
    eventsByDay.set(format(d, "yyyy-MM-dd"), 0);
    eventsByDayMembers.set(format(d, "yyyy-MM-dd"), new Set());
  }
  for (const e of weekEvents) {
    const key = format(new Date(e.start_ts * 1000), "yyyy-MM-dd");
    if (eventsByDay.has(key)) {
      eventsByDay.set(key, (eventsByDay.get(key) ?? 0) + 1);
      if (e.member_id) eventsByDayMembers.get(key)!.add(e.member_id);
    }
  }

  // Today's events specifically
  const todayKey = format(today, "yyyy-MM-dd");
  const todayEvents = weekEvents
    .filter((e) => format(new Date(e.start_ts * 1000), "yyyy-MM-dd") === todayKey)
    .sort((a, b) => a.start_ts - b.start_ts);

  // Chore progress per member (today)
  const todayChores = allChores.filter((c) => isDueOn(c, today));
  const chorePct = new Map<number, { done: number; total: number }>();
  for (const m of members) {
    const memberDue = todayChores.filter((c) => c.assignees.includes(m.id));
    const done = new Set(getCompletions(m.id, today, today).filter((c) => c.verified_at).map((c) => c.chore_id));
    chorePct.set(m.id, { done: memberDue.filter((c) => done.has(c.id)).length, total: memberDue.length });
  }

  const pendingCount = listPendingCompletions().length;

  // Today's full meal plan (breakfast/lunch/dinner) + next week's vote candidates.
  const plan = listPlanForRange(todayKey, todayKey);
  const todayMeals: Partial<Record<MealSlot, Meal>> = {};
  for (const p of plan) {
    if (p.meal_date === todayKey) {
      const meal = getMeal(p.meal_id);
      if (meal) todayMeals[p.slot as MealSlot] = meal;
    }
  }
  const nw = nextWeekStart(today);
  const voteCount = listProposals(nw).length;

  const verse = verseOfDay(today);
  const settings = getAllSettings();
  const hijri = toHijri(today, Number(settings.hijri_offset ?? 0));

  return (
    <FamilyHome
      members={members}
      days={days}
      eventsByDay={eventsByDay}
      eventsByDayMembers={eventsByDayMembers}
      todayEvents={todayEvents}
      chorePct={chorePct}
      pendingCount={pendingCount}
      todayMeals={todayMeals}
      voteCount={voteCount}
      verse={verse}
      hijriDate={hijri.formatted}
    />
  );
}
