import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { db, dataDir } from "./db";
import { getSetting, setSetting } from "./settings";

/**
 * Full-database backup as portable JSON. Every user table is dumped generically
 * (introspected from sqlite_master), so the format survives schema changes —
 * columns present in the live schema are restored, unknown ones are skipped.
 * BLOB values (e.g. member headshots) are base64-encoded under a `__b64` marker.
 */

const BACKUP_APP = "zfamily";
const BACKUP_VERSION = 1;

export type Backup = {
  app: string;
  version: number;
  exportedAt: number;
  tables: Record<string, Array<Record<string, unknown>>>;
};

function userTables(conn: Database.Database): string[] {
  return (
    conn
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
}

function encodeValue(v: unknown): unknown {
  if (Buffer.isBuffer(v)) return { __b64: v.toString("base64") };
  return v;
}

function decodeValue(v: unknown): unknown {
  if (v && typeof v === "object" && "__b64" in (v as Record<string, unknown>)) {
    return Buffer.from(String((v as { __b64: unknown }).__b64), "base64");
  }
  return v;
}

/** Default backups location: a `backups` folder inside the data directory. */
export function defaultBackupDir(): string {
  return path.join(dataDir(), "backups");
}

/** Where backups are written — the `backup_dir` setting if set, else the default. */
export function backupDir(): string {
  return getSetting("backup_dir")?.trim() || defaultBackupDir();
}

export type SavedBackup = { name: string; size: number; savedAt: number };

/** Write a full backup as a timestamped JSON file into the backup directory. */
export function saveBackupToDisk(prefix = "zfamily-backup"): { ok: boolean; reason?: string; name?: string; path?: string; bytes?: number } {
  const dir = backupDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); // 2026-07-09T12-30-00
    const name = `${prefix}-${stamp}.json`;
    const file = path.join(dir, name);
    const json = JSON.stringify(exportAllData());
    fs.writeFileSync(file, json);
    return { ok: true, name, path: file, bytes: Buffer.byteLength(json) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "write_failed" };
  }
}

// ── Periodic auto-backup ─────────────────────────────────────────────
const AUTO_PREFIX = "zfamily-autobackup";
const AUTO_KEEP = 12; // keep the most recent N auto-backups
const AUTO_INTERVAL_SECONDS: Record<string, number> = {
  daily: 86_400,
  weekly: 7 * 86_400,
  monthly: 30 * 86_400,
};

/** Whether auto-backup is on (default true) and how often (default weekly). */
export function autoBackupConfig(): { enabled: boolean; interval: string; lastAt: number } {
  return {
    enabled: (getSetting("auto_backup") ?? "true") === "true",
    interval: getSetting("auto_backup_interval") ?? "weekly",
    lastAt: Number(getSetting("auto_backup_last") ?? 0),
  };
}

function pruneAutoBackups(keep: number) {
  try {
    const dir = backupDir();
    const files = fs
      .readdirSync(dir)
      .filter((n) => n.startsWith(AUTO_PREFIX) && n.endsWith(".json"))
      .map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const f of files.slice(keep)) fs.unlinkSync(path.join(dir, f.n));
  } catch {
    /* best-effort */
  }
}

/** Create an auto-backup if enabled and the interval has elapsed. Cheap to call
 *  frequently (from the sync endpoints) — only writes when actually due. Skips
 *  when there's no family yet (nothing worth backing up). */
export function maybeAutoBackup(): { backedUp: boolean; name?: string } {
  const cfg = autoBackupConfig();
  if (!cfg.enabled) return { backedUp: false };
  const secs = AUTO_INTERVAL_SECONDS[cfg.interval] ?? AUTO_INTERVAL_SECONDS.weekly;
  const now = Math.floor(Date.now() / 1000);
  if (cfg.lastAt && now - cfg.lastAt < secs) return { backedUp: false };
  const hasFamily = ((db().prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n) > 0;
  if (!hasFamily) return { backedUp: false };
  const r = saveBackupToDisk(AUTO_PREFIX);
  if (!r.ok) return { backedUp: false };
  setSetting("auto_backup_last", String(now));
  pruneAutoBackups(AUTO_KEEP);
  return { backedUp: true, name: r.name };
}

/** List backup files currently stored in the backup directory (newest first). */
export function listBackups(): SavedBackup[] {
  const dir = backupDir();
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .map((n) => {
        const st = fs.statSync(path.join(dir, n));
        return { name: n, size: st.size, savedAt: Math.floor(st.mtimeMs / 1000) };
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** Parse a stored backup file by name (basename only — no path traversal). */
export function readStoredBackup(name: string): Backup | null {
  const safe = path.basename(name);
  if (!safe.endsWith(".json")) return null;
  try {
    const raw = fs.readFileSync(path.join(backupDir(), safe), "utf8");
    return JSON.parse(raw) as Backup;
  } catch {
    return null;
  }
}

export function exportAllData(): Backup {
  const conn = db();
  const tables: Record<string, Array<Record<string, unknown>>> = {};
  for (const t of userTables(conn)) {
    const rows = conn.prepare(`SELECT * FROM "${t}"`).all() as Array<Record<string, unknown>>;
    tables[t] = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) out[k] = encodeValue(v);
      return out;
    });
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: Math.floor(Date.now() / 1000), tables };
}

export function backupSummary(b: Backup): { tables: number; rows: number } {
  let rows = 0;
  for (const t of Object.values(b.tables)) rows += Array.isArray(t) ? t.length : 0;
  return { tables: Object.keys(b.tables).length, rows };
}

/** Replace ALL current data with the backup's, inside one transaction (FK off).
 *  On any error the transaction rolls back, leaving the live data untouched. */
export function importAllData(backup: unknown): { ok: boolean; reason?: string; rows?: number } {
  const b = backup as Partial<Backup> | null;
  if (!b || b.app !== BACKUP_APP || !b.tables || typeof b.tables !== "object") {
    return { ok: false, reason: "not_a_zfamily_backup" };
  }
  const conn = db();
  const existing = new Set(userTables(conn));
  conn.pragma("foreign_keys = OFF");
  try {
    let rows = 0;
    const run = conn.transaction(() => {
      // Clear every current table, then load the backup.
      for (const t of existing) conn.prepare(`DELETE FROM "${t}"`).run();
      try {
        conn.prepare("DELETE FROM sqlite_sequence").run();
      } catch {
        // sqlite_sequence only exists once an AUTOINCREMENT table has held data.
      }
      for (const [t, tableRows] of Object.entries(b.tables!)) {
        if (!existing.has(t) || !Array.isArray(tableRows)) continue;
        const cols = new Set(
          (conn.prepare(`PRAGMA table_info("${t}")`).all() as Array<{ name: string }>).map((c) => c.name)
        );
        for (const row of tableRows) {
          const keys = Object.keys(row).filter((k) => cols.has(k));
          if (keys.length === 0) continue;
          const stmt = conn.prepare(
            `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map(() => "?").join(",")})`
          );
          stmt.run(...keys.map((k) => decodeValue((row as Record<string, unknown>)[k])));
          rows++;
        }
      }
    });
    run();
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "import_failed" };
  } finally {
    conn.pragma("foreign_keys = ON");
  }
}
