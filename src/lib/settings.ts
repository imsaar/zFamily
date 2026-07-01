import { db } from "./db";

export function getSetting(key: string): string | undefined {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db().prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** IANA timezone derived from the weather location (or the server's TZ if
 *  the user hasn't picked a location yet). Use this instead of `new Date()`
 *  when the value is user-facing. */
export function getTimezone(): string {
  const tz = getSetting("weather_tz");
  if (tz && tz !== "auto") return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
