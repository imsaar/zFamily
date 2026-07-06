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

export function createMember(input: { name: string; nickname?: string | null; color: MemberColor; emoji?: string | null; role?: MemberRole }): number {
  const now = Math.floor(Date.now() / 1000);
  const maxOrder = (db().prepare("SELECT COALESCE(MAX(sort_order), -1) as n FROM members").get() as { n: number }).n;
  const r = db()
    .prepare(
      "INSERT INTO members (name, nickname, color, emoji, role, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(input.name, input.nickname ?? null, input.color, input.emoji ?? null, input.role ?? "parent", maxOrder + 1, now);
  return Number(r.lastInsertRowid);
}

export function updateMember(id: number, patch: Partial<Pick<Member, "name" | "nickname" | "color" | "emoji" | "role">>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.nickname !== undefined) {
    fields.push("nickname = ?");
    values.push(patch.nickname);
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

/** Store (or replace) a member's headshot photo. Bumps `photo_updated_at` on
 *  the member so avatar <img> URLs cache-bust. */
export function setMemberPhoto(memberId: number, mime: string, data: Buffer) {
  const now = Math.floor(Date.now() / 1000);
  const tx = db().transaction(() => {
    db()
      .prepare(
        "INSERT INTO member_photos (member_id, mime, data, updated_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(member_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at"
      )
      .run(memberId, mime, data, now);
    db().prepare("UPDATE members SET photo_updated_at = ? WHERE id = ?").run(now, memberId);
  });
  tx();
}

export function getMemberPhoto(memberId: number): { mime: string; data: Buffer } | undefined {
  const row = db()
    .prepare("SELECT mime, data FROM member_photos WHERE member_id = ?")
    .get(memberId) as { mime: string; data: Buffer } | undefined;
  return row;
}

export function clearMemberPhoto(memberId: number) {
  const tx = db().transaction(() => {
    db().prepare("DELETE FROM member_photos WHERE member_id = ?").run(memberId);
    db().prepare("UPDATE members SET photo_updated_at = NULL WHERE id = ?").run(memberId);
  });
  tx();
}
