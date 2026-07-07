import ical from "node-ical";
import { db } from "./db";
import { upsertEvent } from "./events";

export type IcalFeed = {
  id: number;
  name: string;
  url: string;
  member_id: number | null;
  color: string | null;
  interval_hours: number;
  active: number;
  last_synced_at: number | null;
  last_status: string | null;
  last_event_count: number | null;
  created_at: number;
};

// How far back / forward to materialize occurrences from a feed. Recurring
// events are pre-expanded into concrete rows within this window at sync time,
// so the calendar pages need no special handling — they read `events` as usual.
const WINDOW_BACK_DAYS = 31;
const WINDOW_FWD_DAYS = 400;

export function listFeeds(): IcalFeed[] {
  return db().prepare("SELECT * FROM ical_feeds ORDER BY created_at").all() as IcalFeed[];
}

export function getFeed(id: number): IcalFeed | undefined {
  return db().prepare("SELECT * FROM ical_feeds WHERE id = ?").get(id) as IcalFeed | undefined;
}

/** Normalize a user-supplied subscription URL. Accepts https and the
 *  `webcal://` scheme Google/Apple hand out, which is just https over the wire. */
export function normalizeFeedUrl(raw: string): string {
  let u = raw.trim();
  if (u.startsWith("webcal://")) u = "https://" + u.slice("webcal://".length);
  return u;
}

export function createFeed(input: {
  name: string;
  url: string;
  member_id?: number | null;
  color?: string | null;
  interval_hours?: number;
}): number {
  const now = Math.floor(Date.now() / 1000);
  const r = db()
    .prepare(
      "INSERT INTO ical_feeds (name, url, member_id, color, interval_hours, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
    )
    .run(
      input.name.trim(),
      normalizeFeedUrl(input.url),
      input.member_id ?? null,
      input.color ?? null,
      clampInterval(input.interval_hours),
      now
    );
  return Number(r.lastInsertRowid);
}

export function updateFeed(
  id: number,
  patch: Partial<{ name: string; url: string; member_id: number | null; color: string | null; interval_hours: number; active: number }>
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) { fields.push("name = ?"); values.push(patch.name.trim()); }
  if (patch.url !== undefined) { fields.push("url = ?"); values.push(normalizeFeedUrl(patch.url)); }
  if (patch.member_id !== undefined) { fields.push("member_id = ?"); values.push(patch.member_id); }
  if (patch.color !== undefined) { fields.push("color = ?"); values.push(patch.color); }
  if (patch.interval_hours !== undefined) { fields.push("interval_hours = ?"); values.push(clampInterval(patch.interval_hours)); }
  if (patch.active !== undefined) { fields.push("active = ?"); values.push(patch.active); }
  if (fields.length === 0) return;
  values.push(id);
  db().prepare(`UPDATE ical_feeds SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteFeed(id: number) {
  const tx = db().transaction(() => {
    db().prepare("DELETE FROM events WHERE calendar_id = ?").run(feedCalendarId(id));
    db().prepare("DELETE FROM ical_feeds WHERE id = ?").run(id);
  });
  tx();
}

function clampInterval(h: number | undefined): number {
  const n = Math.round(Number(h ?? 6));
  if (!Number.isFinite(n)) return 6;
  return Math.max(1, Math.min(168, n)); // 1 hour .. 1 week
}

function feedCalendarId(feedId: number): string {
  return `ical:${feedId}`;
}

/** Convert a node-ical instance start/end into stored unix timestamps.
 *  All-day events are pinned to *local* midnight of their calendar date — the
 *  rest of the app formats timestamps in the server's local timezone (e.g.
 *  `format(new Date(ts*1000), 'yyyy-MM-dd')`), so a local-midnight timestamp is
 *  what makes an all-day event land on the correct day everywhere (home
 *  "today" list, week/month grouping). UTC midnight would shift it a day in any
 *  timezone behind UTC. */
function toStored(start: Date, end: Date, fullDay: boolean): { start_ts: number; end_ts: number; all_day: number } {
  if (fullDay) {
    const { y, m, d } = calendarDate(start);
    const s = Math.floor(new Date(y, m, d, 0, 0, 0, 0).getTime() / 1000); // local midnight
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    return { start_ts: s, end_ts: s + days * 86_400, all_day: 1 };
  }
  return { start_ts: Math.floor(start.getTime() / 1000), end_ts: Math.floor(end.getTime() / 1000), all_day: 0 };
}

// node-ical returns an all-day DATE as a midnight Date object (in some offset).
// Shift by 12h before reading UTC parts so the intended calendar date is
// recovered regardless of that offset (|offset| < 12h always).
function calendarDate(d: Date): { y: number; m: number; d: number } {
  const noonish = new Date(d.getTime() + 12 * 3600 * 1000);
  return { y: noonish.getUTCFullYear(), m: noonish.getUTCMonth(), d: noonish.getUTCDate() };
}

/** Fetch and re-materialize one feed. Replaces all of the feed's events. */
export async function syncFeed(feed: IcalFeed): Promise<{ ok: boolean; count: number; error?: string }> {
  const calId = feedCalendarId(feed.id);
  const now = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(feed.url, {
      redirect: "follow",
      headers: { "User-Agent": "zFamily/1.0 (+ical-subscription)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("Not an iCalendar feed");

    const parsed = ical.sync.parseICS(text);
    const from = new Date(Date.now() - WINDOW_BACK_DAYS * 86_400_000);
    const to = new Date(Date.now() + WINDOW_FWD_DAYS * 86_400_000);

    type Row = { id: string; title: string; start_ts: number; end_ts: number; all_day: number; location: string | null; notes: string | null };
    const rows: Row[] = [];
    for (const comp of Object.values(parsed)) {
      if (!comp || comp.type !== "VEVENT") continue;
      let instances: ReturnType<typeof ical.expandRecurringEvent>;
      try {
        instances = ical.expandRecurringEvent(comp, { from, to });
      } catch {
        continue; // skip a single malformed event rather than failing the feed
      }
      for (const inst of instances) {
        if (!inst.start || !inst.end) continue;
        const { start_ts, end_ts, all_day } = toStored(inst.start, inst.end, inst.isFullDay);
        const uid = comp.uid || String(inst.summary ?? "event");
        rows.push({
          id: `${calId}:${uid}:${start_ts}`,
          title: String(inst.summary ?? comp.summary ?? "(no title)").trim() || "(no title)",
          start_ts,
          end_ts,
          all_day,
          location: comp.location ? String(comp.location) : null,
          notes: comp.description ? String(comp.description) : null,
        });
      }
    }

    // Replace the feed's events wholesale — subscriptions are read-only, so a
    // clean swap correctly reflects deletions and edits upstream.
    const tx = db().transaction(() => {
      db().prepare("DELETE FROM events WHERE calendar_id = ?").run(calId);
      for (const r of rows) {
        upsertEvent({
          id: r.id,
          member_id: feed.member_id,
          calendar_id: calId,
          title: r.title,
          start_ts: r.start_ts,
          end_ts: r.end_ts,
          all_day: r.all_day,
          location: r.location,
          notes: r.notes,
          rrule: null,
          etag: null,
          source: "ical",
        });
      }
      db()
        .prepare("UPDATE ical_feeds SET last_synced_at = ?, last_status = 'ok', last_event_count = ? WHERE id = ?")
        .run(now, rows.length, feed.id);
    });
    tx();
    return { ok: true, count: rows.length };
  } catch (err) {
    const msg = (err as Error).message || "sync failed";
    db()
      .prepare("UPDATE ical_feeds SET last_synced_at = ?, last_status = ? WHERE id = ?")
      .run(now, `error: ${msg}`.slice(0, 300), feed.id);
    return { ok: false, count: 0, error: msg };
  }
}

/** Sync feeds whose interval has elapsed (or all active feeds when forced). */
export async function syncDueFeeds(opts?: { force?: boolean; feedId?: number }): Promise<{ synced: number; totalEvents: number }> {
  const now = Math.floor(Date.now() / 1000);
  let feeds = listFeeds().filter((f) => f.active);
  if (opts?.feedId) feeds = feeds.filter((f) => f.id === opts.feedId);
  let synced = 0;
  let totalEvents = 0;
  for (const f of feeds) {
    const due = opts?.force || !f.last_synced_at || now - f.last_synced_at >= f.interval_hours * 3600;
    if (!due) continue;
    const r = await syncFeed(f);
    synced++;
    totalEvents += r.count;
  }
  return { synced, totalEvents };
}
