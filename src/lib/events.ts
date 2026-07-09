import { db } from "./db";
import type { EventRow } from "./types";

// Attach `member_ids` (all participants) to event rows. Falls back to the
// single `member_id` when there are no join rows (e.g. Google-synced events).
function withMembers(rows: EventRow[]): EventRow[] {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);
  const links = db()
    .prepare(`SELECT event_id, member_id FROM event_members WHERE event_id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Array<{ event_id: string; member_id: number }>;
  const byEvent = new Map<string, number[]>();
  for (const l of links) {
    if (!byEvent.has(l.event_id)) byEvent.set(l.event_id, []);
    byEvent.get(l.event_id)!.push(l.member_id);
  }
  for (const r of rows) {
    const list = byEvent.get(r.id);
    r.member_ids = list && list.length ? list : r.member_id != null ? [r.member_id] : [];
  }
  return rows;
}

export function listEventsInRange(startTs: number, endTs: number): EventRow[] {
  const rows = db()
    .prepare(
      `SELECT * FROM events
       WHERE start_ts < ? AND end_ts > ?
       ORDER BY start_ts ASC`
    )
    .all(endTs, startTs) as EventRow[];
  return withMembers(rows);
}

export function getEvent(id: string): EventRow | undefined {
  const row = db().prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow | undefined;
  return row ? withMembers([row])[0] : undefined;
}

export function upsertEvent(e: Omit<EventRow, "updated_at" | "member_ids"> & { updated_at?: number; member_ids?: number[] }) {
  const now = e.updated_at ?? Math.floor(Date.now() / 1000);
  // If participants are provided, the primary member_id is the first of them.
  const primary = e.member_ids !== undefined ? (e.member_ids[0] ?? null) : e.member_id;
  db()
    .prepare(
      `INSERT INTO events (id, member_id, calendar_id, title, start_ts, end_ts, all_day, location, address, notes, rrule, etag, source, commute_seconds, commute_mode, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         member_id=excluded.member_id,
         calendar_id=excluded.calendar_id,
         title=excluded.title,
         start_ts=excluded.start_ts,
         end_ts=excluded.end_ts,
         all_day=excluded.all_day,
         location=excluded.location,
         address=excluded.address,
         notes=excluded.notes,
         rrule=excluded.rrule,
         etag=excluded.etag,
         source=excluded.source,
         commute_seconds=excluded.commute_seconds,
         commute_mode=excluded.commute_mode,
         updated_at=excluded.updated_at`
    )
    .run(
      e.id,
      primary,
      e.calendar_id,
      e.title,
      e.start_ts,
      e.end_ts,
      e.all_day,
      e.location,
      e.address,
      e.notes,
      e.rrule,
      e.etag,
      e.source,
      e.commute_seconds ?? null,
      e.commute_mode ?? null,
      now
    );
  // Rewrite the participants join only when the caller manages it (member_ids
  // provided). Google sync omits it and keeps the single member_id.
  if (e.member_ids !== undefined) {
    db().prepare("DELETE FROM event_members WHERE event_id = ?").run(e.id);
    const ins = db().prepare("INSERT OR IGNORE INTO event_members (event_id, member_id) VALUES (?, ?)");
    for (const m of e.member_ids) ins.run(e.id, m);
  }
}

export function deleteEvent(id: string) {
  db().prepare("DELETE FROM events WHERE id = ?").run(id);
}

export function createLocalEvent(input: {
  member_ids: number[];
  title: string;
  start_ts: number;
  end_ts: number;
  all_day?: boolean;
  location?: string;
  address?: string | null;
  notes?: string;
  recurrence?: "none" | "daily" | "weekdays" | "weekly" | "monthly" | null;
  // For weekly/monthly: repeat every N weeks/months. The weekday (weekly) and
  // day-of-month (monthly) come from the event's start date.
  interval?: number;
  commute_seconds?: number | null;
  commute_mode?: string | null;
}): string {
  const id = `local-${crypto.randomUUID()}`;
  const iv = Math.max(1, Math.round(input.interval ?? 1));
  const ivPart = iv > 1 ? `;INTERVAL=${iv}` : "";
  let rrule: string | null = null;
  switch (input.recurrence) {
    case "daily":     rrule = "FREQ=DAILY"; break;
    case "weekdays":  rrule = "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR"; break;
    case "weekly":    rrule = `FREQ=WEEKLY${ivPart}`; break;
    case "monthly":   rrule = `FREQ=MONTHLY${ivPart}`; break;
    default:          rrule = null;
  }
  upsertEvent({
    id,
    member_id: input.member_ids[0] ?? null,
    member_ids: input.member_ids,
    calendar_id: "local",
    title: input.title,
    start_ts: input.start_ts,
    end_ts: input.end_ts,
    all_day: input.all_day ? 1 : 0,
    location: input.location ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
    rrule,
    etag: null,
    source: "local",
    commute_seconds: input.commute_seconds ?? null,
    commute_mode: input.commute_mode ?? null,
  });
  return id;
}

/** Expands a stored event into an array of virtual instances that fall in
 *  [startTs, endTs]. Non-recurring events are returned as-is; recurring
 *  events are expanded up to a maximum count. */
export function expandRecurrences(events: EventRow[], startTs: number, endTs: number, maxPerEvent = 100): EventRow[] {
  const out: EventRow[] = [];
  for (const e of events) {
    if (!e.rrule) {
      out.push(e);
      continue;
    }
    const rule = parseRRule(e.rrule);
    if (!rule) { out.push(e); continue; }
    const duration = e.end_ts - e.start_ts;
    let cursor = e.start_ts;
    let count = 0;
    while (cursor <= endTs && count < maxPerEvent) {
      // BYDAY (e.g. weekdays) filters which occurrences count; we still advance
      // daily and skip days not in the set.
      const inByDay = !rule.byDays || rule.byDays.has(new Date(cursor * 1000).getDay());
      if (inByDay && cursor + duration >= startTs) {
        out.push({ ...e, id: `${e.id}::${cursor}`, start_ts: cursor, end_ts: cursor + duration });
      }
      cursor = advance(cursor, rule);
      count++;
    }
  }
  return out;
}

type ParsedRRule = { freq: "WEEKLY" | "MONTHLY" | "DAILY" | "YEARLY"; interval: number; byDays?: Set<number> };

// RRULE weekday codes → JS getDay() index (Sun=0 … Sat=6).
const BYDAY_TO_DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRRule(s: string): ParsedRRule | null {
  const parts: Record<string, string> = {};
  for (const p of s.split(";")) {
    const [k, v] = p.split("=");
    if (k && v) parts[k.trim().toUpperCase()] = v.trim().toUpperCase();
  }
  const freq = parts["FREQ"];
  if (!freq || !["WEEKLY", "MONTHLY", "DAILY", "YEARLY"].includes(freq)) return null;
  const interval = Number(parts["INTERVAL"] ?? "1") || 1;
  let byDays: Set<number> | undefined;
  if (parts["BYDAY"]) {
    const days = parts["BYDAY"].split(",").map((c) => BYDAY_TO_DOW[c]).filter((n) => n !== undefined);
    if (days.length) byDays = new Set(days);
  }
  return { freq: freq as ParsedRRule["freq"], interval, byDays };
}

function advance(ts: number, rule: ParsedRRule): number {
  const d = new Date(ts * 1000);
  switch (rule.freq) {
    case "DAILY":   d.setDate(d.getDate() + rule.interval); break;
    case "WEEKLY":  d.setDate(d.getDate() + 7 * rule.interval); break;
    case "MONTHLY": d.setMonth(d.getMonth() + rule.interval); break;
    case "YEARLY":  d.setFullYear(d.getFullYear() + rule.interval); break;
  }
  return Math.floor(d.getTime() / 1000);
}
