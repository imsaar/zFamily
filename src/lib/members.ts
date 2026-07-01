import { db } from "./db";
import type { Member, MemberColor, MemberRole } from "./types";

export function listMembers(): Member[] {
  return db()
    .prepare("SELECT * FROM members ORDER BY sort_order, id")
    .all() as Member[];
}

export function getMember(id: number): Member | undefined {
  return db().prepare("SELECT * FROM members WHERE id = ?").get(id) as Member | undefined;
}

export function createMember(input: { name: string; color: MemberColor; emoji?: string | null; role?: MemberRole }): number {
  const now = Math.floor(Date.now() / 1000);
  const maxOrder = (db().prepare("SELECT COALESCE(MAX(sort_order), -1) as n FROM members").get() as { n: number }).n;
  const r = db()
    .prepare(
      "INSERT INTO members (name, color, emoji, role, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(input.name, input.color, input.emoji ?? null, input.role ?? "parent", maxOrder + 1, now);
  return Number(r.lastInsertRowid);
}

export function updateMember(id: number, patch: Partial<Pick<Member, "name" | "color" | "emoji" | "role">>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.color !== undefined) {
    fields.push("color = ?");
    values.push(patch.color);
  }
  if (patch.emoji !== undefined) {
    fields.push("emoji = ?");
    values.push(patch.emoji);
  }
  if (patch.role !== undefined) {
    fields.push("role = ?");
    values.push(patch.role);
  }
  if (fields.length === 0) return;
  values.push(id);
  db().prepare(`UPDATE members SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function listParents(): Member[] {
  return db()
    .prepare("SELECT * FROM members WHERE role = 'parent' ORDER BY sort_order, id")
    .all() as Member[];
}

export function deleteMember(id: number) {
  db().prepare("DELETE FROM members WHERE id = ?").run(id);
}
