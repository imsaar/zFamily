import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import crypto from "node:crypto";

const DATA_DIR = path.resolve(process.cwd(), ".data-e2e");
export const DB_PATH = path.join(DATA_DIR, "zfamily.db");

export function openDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return new Database(DB_PATH);
}

/** Wipe the e2e DB so tests start from a known clean slate. */
export function resetDb() {
  try { fs.rmSync(DB_PATH); } catch {}
  try { fs.rmSync(DB_PATH + "-wal"); } catch {}
  try { fs.rmSync(DB_PATH + "-shm"); } catch {}
}

/** Seed a known test family (Mom=1, Dad=2, Aisha=3, Zayn=4), a set of chores,
 *  and default weather/display settings. The app itself no longer seeds a demo
 *  family (fresh installs run the first-run setup workflow), so the e2e suite
 *  provisions its own fixed fixture here. Idempotent: no-op if members exist. */
export function seedTestFamily() {
  const db = openDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n;
  if (count > 0) {
    db.close();
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const insertMember = db.prepare(
    "INSERT INTO members (name, color, emoji, role, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const members = [
    { name: "Mom", color: "rose", emoji: "👩", role: "parent", order: 0 },
    { name: "Dad", color: "sky", emoji: "👨", role: "parent", order: 1 },
    { name: "Aisha", color: "emerald", emoji: "👧", role: "child", order: 2 },
    { name: "Zayn", color: "amber", emoji: "👦", role: "child", order: 3 },
  ];
  const ids: number[] = [];
  for (const m of members) {
    const r = insertMember.run(m.name, m.color, m.emoji, m.role, m.order, now);
    ids.push(Number(r.lastInsertRowid));
  }

  const insertChore = db.prepare(
    "INSERT INTO chores (title, icon, points, recurrence, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  );
  const assign = db.prepare("INSERT INTO chore_assignees (chore_id, member_id) VALUES (?, ?)");
  const chores: Array<{ title: string; icon: string; points: number; recurrence: string; assignees: number[] }> = [
    { title: "Make bed", icon: "🛏️", points: 1, recurrence: "daily", assignees: [ids[2], ids[3]] },
    { title: "Brush teeth (AM)", icon: "🪥", points: 1, recurrence: "daily", assignees: [ids[2], ids[3]] },
    { title: "Empty dishwasher", icon: "🍽️", points: 3, recurrence: "daily", assignees: [ids[0]] },
    { title: "Take out trash", icon: "🗑️", points: 3, recurrence: "weekly:MON,THU", assignees: [ids[1]] },
    { title: "Homework", icon: "📚", points: 5, recurrence: "weekdays", assignees: [ids[2], ids[3]] },
  ];
  for (const c of chores) {
    const r = insertChore.run(c.title, c.icon, c.points, c.recurrence, now);
    const cid = Number(r.lastInsertRowid);
    for (const mid of c.assignees) assign.run(cid, mid);
  }

  const setting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  const defaults: Array<[string, string]> = [
    ["weather_lat", "37.7749"],
    ["weather_lon", "-122.4194"],
    ["weather_label", "San Francisco"],
    ["weather_tz", "America/Los_Angeles"],
    ["quiet_start", "21:00"],
    ["quiet_end", "07:00"],
    ["chore_reset_hour", "4"],
    ["idle_seconds", "300"],
    ["screensaver_mode", "clock"],
    ["personal_idle_seconds", "120"],
    ["hijri_offset", "0"],
  ];
  for (const [k, v] of defaults) setting.run(k, v);
  db.close();
}

/** After the app has seeded the DB, set known PINs for Mom and Dad so tests
 *  can log in via the keypad. */
export function setKnownParentPins(momPin = "1111", dadPin = "2222") {
  const db = openDb();
  const setPin = (memberId: number, pin: string) => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(pin, salt, 32, { N: 1 << 14 }).toString("hex");
    db.prepare("UPDATE members SET pin_hash = ?, pin_salt = ? WHERE id = ?").run(hash, salt, memberId);
  };
  setPin(1, momPin);
  setPin(2, dadPin);
  db.close();
}

export function readSetting(key: string): string | undefined {
  const db = openDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  db.close();
  return row?.value;
}

export function writeSetting(key: string, value: string) {
  const db = openDb();
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(key, value, value);
  db.close();
}
