import type Database from "better-sqlite3";
import { db } from "./db";

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
