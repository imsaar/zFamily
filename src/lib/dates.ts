import { startOfWeek, endOfWeek, addDays, addWeeks, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";

export function weekRange(d: Date, weekStart: 0 | 1 = 0) {
  const s = startOfWeek(d, { weekStartsOn: weekStart });
  const e = endOfWeek(d, { weekStartsOn: weekStart });
  return { start: s, end: e };
}

export function weekDays(d: Date, weekStart: 0 | 1 = 0): Date[] {
  const s = startOfWeek(d, { weekStartsOn: weekStart });
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export function monthGrid(d: Date, weekStart: 0 | 1 = 0): Date[] {
  const monthStart = startOfMonth(d);
  const monthEnd = endOfMonth(d);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: weekStart });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: weekStart });
  const days: Date[] = [];
  let cur = gridStart;
  while (cur <= gridEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

export function dayRange(d: Date) {
  return { start: startOfDay(d), end: endOfDay(d) };
}

export function parseDateParam(s: string | undefined | null): Date {
  if (!s) return new Date();
  const t = Date.parse(s);
  if (isNaN(t)) return new Date();
  return new Date(t);
}

export function addWeek(d: Date, n: number) { return addWeeks(d, n); }
