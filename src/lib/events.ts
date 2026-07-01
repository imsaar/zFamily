import { db } from "./db";
import type { EventRow } from "./types";

export function listEventsInRange(startTs: number, endTs: number): EventRow[] {
  return db()
    .prepare(
      `SELECT * FROM events
       WHERE start_ts < ? AND end_ts > ?
       ORDER BY start_ts ASC`
    )
    .all(endTs, startTs) as EventRow[];
}

export function getEvent(id: string): EventRow | undefined {
  return db().prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow | undefined;
}

export function upsertEvent(e: Omit<EventRow, "updated_at"> & { updated_at?: number }) {
  const now = e.updated_at ?? Math.floor(Date.now() / 1000);
  db()
    .prepare(
      `INSERT INTO events (id, member_id, calendar_id, title, start_ts, end_ts, all_day, location, notes, rrule, etag, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         member_id=excluded.member_id,
         calendar_id=excluded.calendar_id,
         title=excluded.title,
         start_ts=excluded.start_ts,
         end_ts=excluded.end_ts,
         all_day=excluded.all_day,
         location=excluded.location,
         notes=excluded.notes,
         rrule=excluded.rrule,
         etag=excluded.etag,
         source=excluded.source,
         updated_at=excluded.updated_at`
    )
    .run(
      e.id,
      e.member_id,
      e.calendar_id,
      e.title,
      e.start_ts,
      e.end_ts,
      e.all_day,
      e.location,
      e.notes,
      e.rrule,
      e.etag,
      e.source,
      now
    );
}

export function deleteEvent(id: string) {
  db().prepare("DELETE FROM events WHERE id = ?").run(id);
}

export function createLocalEvent(input: {
  member_id: number | null;
  title: string;
  start_ts: number;
  end_ts: number;
  all_day?: boolean;
  location?: string;
  notes?: string;
  recurrence?: "none" | "weekly" | "monthly" | "quarterly" | null;
}): string {
  const id = `local-${crypto.randomUUID()}`;
  let rrule: string | null = null;
  switch (input.recurrence) {
    case "weekly":    rrule = "FREQ=WEEKLY"; break;
    case "monthly":   rrule = "FREQ=MONTHLY"; break;
    case "quarterly": rrule = "FREQ=MONTHLY;INTERVAL=3"; break;
    default:          rrule = null;
  }
  upsertEvent({
    id,
    member_id: input.member_id,
    calendar_id: "local",
    title: input.title,
    start_ts: input.start_ts,
    end_ts: input.end_ts,
    all_day: input.all_day ? 1 : 0,
    location: input.location ?? null,
    notes: input.notes ?? null,
    rrule,
    etag: null,
    source: "local",
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
      if (cursor + duration >= startTs) {
        out.push({ ...e, id: `${e.id}::${cursor}`, start_ts: cursor, end_ts: cursor + duration });
      }
      cursor = advance(cursor, rule);
      count++;
    }
  }
  return out;
}

type ParsedRRule = { freq: "WEEKLY" | "MONTHLY" | "DAILY" | "YEARLY"; interval: number };

function parseRRule(s: string): ParsedRRule | null {
  const parts: Record<string, string> = {};
  for (const p of s.split(";")) {
    const [k, v] = p.split("=");
    if (k && v) parts[k.trim().toUpperCase()] = v.trim().toUpperCase();
  }
  const freq = parts["FREQ"];
  if (!freq || !["WEEKLY", "MONTHLY", "DAILY", "YEARLY"].includes(freq)) return null;
  const interval = Number(parts["INTERVAL"] ?? "1") || 1;
  return { freq: freq as ParsedRRule["freq"], interval };
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
