import crypto from "node:crypto";
import { db } from "./db";

const SCRYPT_KEY_LEN = 32;
const SCRYPT_N = 1 << 14; // 16384 — modest cost, plenty for a family LAN

function scrypt(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, SCRYPT_KEY_LEN, { N: SCRYPT_N }).toString("hex");
}

function normalize(pin: string): string {
  return String(pin).replace(/\D/g, "");
}

/** Set (or replace) a PIN for a member. PIN must be exactly 4 digits. */
export function setMemberPin(memberId: number, pin: string): { ok: boolean; reason?: string } {
  const p = normalize(pin);
  if (p.length !== 4) return { ok: false, reason: "pin_must_be_4_digits" };
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = scrypt(p, salt);
  db()
    .prepare("UPDATE members SET pin_hash = ?, pin_salt = ? WHERE id = ?")
    .run(hash, salt, memberId);
  return { ok: true };
}

export function clearMemberPin(memberId: number) {
  db()
    .prepare("UPDATE members SET pin_hash = NULL, pin_salt = NULL WHERE id = ?")
    .run(memberId);
}

export function memberHasPin(memberId: number): boolean {
  const row = db()
    .prepare("SELECT pin_hash FROM members WHERE id = ?")
    .get(memberId) as { pin_hash: string | null } | undefined;
  return !!row?.pin_hash;
}

export function verifyMemberPin(memberId: number, pin: string): boolean {
  const p = normalize(pin);
  if (p.length !== 4) return false;
  const row = db()
    .prepare("SELECT pin_hash, pin_salt FROM members WHERE id = ?")
    .get(memberId) as { pin_hash: string | null; pin_salt: string | null } | undefined;
  if (!row?.pin_hash || !row.pin_salt) return true; // no PIN set → open
  const actual = scrypt(p, row.pin_salt);
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(row.pin_hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Guard used by protected actions. Throws-like on failure via return value. */
export function requirePin(memberId: number, pin?: string | null): { ok: boolean; reason?: string } {
  if (!memberHasPin(memberId)) return { ok: true };
  if (!pin) return { ok: false, reason: "pin_required" };
  return verifyMemberPin(memberId, pin) ? { ok: true } : { ok: false, reason: "pin_invalid" };
}

/** List of members who have a PIN set (used by clients to know whether to prompt). */
export function memberPinFlags(): Record<number, boolean> {
  const rows = db()
    .prepare("SELECT id, pin_hash FROM members")
    .all() as Array<{ id: number; pin_hash: string | null }>;
  const map: Record<number, boolean> = {};
  for (const r of rows) map[r.id] = !!r.pin_hash;
  return map;
}
