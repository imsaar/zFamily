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
