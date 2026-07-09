import { db } from "./db";
import type { Chore, ChoreCompletion, Member } from "./types";
import { format } from "date-fns";

export type ChoreWithAssignees = Chore & { assignees: number[] };

export function listChores(): ChoreWithAssignees[] {
  const chores = db().prepare("SELECT * FROM chores WHERE active = 1 ORDER BY id").all() as Chore[];
  const assigns = db().prepare("SELECT chore_id, member_id FROM chore_assignees").all() as Array<{
    chore_id: number;
    member_id: number;
  }>;
  const map = new Map<number, number[]>();
  for (const a of assigns) {
    if (!map.has(a.chore_id)) map.set(a.chore_id, []);
    map.get(a.chore_id)!.push(a.member_id);
  }
  return chores.map((c) => ({ ...c, assignees: map.get(c.id) ?? [] }));
}

export function createChore(input: {
  title: string;
  icon?: string | null;
  points?: number;
  recurrence: string;
  assignees: number[];
  shared?: boolean;
}): number {
  const now = Math.floor(Date.now() / 1000);
  const shared = input.shared ? 1 : 0;
  const r = db()
    .prepare(
      "INSERT INTO chores (title, icon, points, recurrence, active, shared, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
    )
    .run(input.title, input.icon ?? null, input.points ?? 1, input.recurrence, shared, now);
  const id = Number(r.lastInsertRowid);
  // Common chores have no assignees.
  if (!shared) {
    const assignStmt = db().prepare("INSERT INTO chore_assignees (chore_id, member_id) VALUES (?, ?)");
    for (const m of input.assignees) assignStmt.run(id, m);
  }
  return id;
}

export function updateChore(
  id: number,
  patch: { title?: string; icon?: string | null; points?: number; recurrence?: string; assignees?: number[]; shared?: boolean }
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) { fields.push("title = ?"); values.push(patch.title); }
  if (patch.icon !== undefined) { fields.push("icon = ?"); values.push(patch.icon); }
  if (patch.points !== undefined) { fields.push("points = ?"); values.push(patch.points); }
  if (patch.recurrence !== undefined) { fields.push("recurrence = ?"); values.push(patch.recurrence); }
  if (patch.shared !== undefined) { fields.push("shared = ?"); values.push(patch.shared ? 1 : 0); }
  if (fields.length > 0) {
    values.push(id);
    db().prepare(`UPDATE chores SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }
  if (patch.shared === true) {
    // A common chore has no assignees.
    db().prepare("DELETE FROM chore_assignees WHERE chore_id = ?").run(id);
  } else if (patch.assignees) {
    db().prepare("DELETE FROM chore_assignees WHERE chore_id = ?").run(id);
    const ins = db().prepare("INSERT INTO chore_assignees (chore_id, member_id) VALUES (?, ?)");
    for (const m of patch.assignees) ins.run(id, m);
  }
}

/** The single completion for a common chore on a given day (whoever did it),
 *  or undefined if nobody has done it yet. */
export function sharedCompletionFor(choreId: number, date: Date): ChoreCompletion | undefined {
  return db()
    .prepare("SELECT * FROM chore_completions WHERE chore_id = ? AND completed_for = ? LIMIT 1")
    .get(choreId, format(date, "yyyy-MM-dd")) as ChoreCompletion | undefined;
}

/** Complete a common chore, attributed to `byMemberId`. Blocks if someone has
 *  already done it for this period (one completion per chore per day). */
export function completeSharedChore(choreId: number, byMemberId: number, date: Date): { ok: boolean; reason?: string } {
  const dayStr = format(date, "yyyy-MM-dd");
  const existing = db()
    .prepare("SELECT id FROM chore_completions WHERE chore_id = ? AND completed_for = ? LIMIT 1")
    .get(choreId, dayStr) as { id: number } | undefined;
  if (existing) return { ok: false, reason: "already_done" };
  db()
    .prepare("INSERT INTO chore_completions (chore_id, member_id, completed_for, completed_at) VALUES (?, ?, ?, ?)")
    .run(choreId, byMemberId, dayStr, Math.floor(Date.now() / 1000));
  return { ok: true };
}

/** Undo a common chore's completion for the day (unlocks it for others). */
export function uncompleteSharedChore(choreId: number, date: Date) {
  db()
    .prepare("DELETE FROM chore_completions WHERE chore_id = ? AND completed_for = ?")
    .run(choreId, format(date, "yyyy-MM-dd"));
}

export function deleteChore(id: number) {
  db().prepare("UPDATE chores SET active = 0 WHERE id = ?").run(id);
}

export function isDueOn(chore: { recurrence: string }, date: Date): boolean {
  const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const wd = weekdayNames[date.getDay()];
  const r = chore.recurrence;
  if (r === "daily") return true;
  if (r === "weekdays") return wd !== "SAT" && wd !== "SUN";
  if (r === "weekends") return wd === "SAT" || wd === "SUN";
  if (r.startsWith("weekly:")) {
    const days = r.slice("weekly:".length).split(",");
    return days.includes(wd);
  }
  return false;
}

export function getCompletions(memberId: number, fromDate: Date, toDate: Date): ChoreCompletion[] {
  return db()
    .prepare(
      `SELECT * FROM chore_completions
       WHERE member_id = ? AND completed_for >= ? AND completed_for <= ?`
    )
    .all(memberId, format(fromDate, "yyyy-MM-dd"), format(toDate, "yyyy-MM-dd")) as ChoreCompletion[];
}

export function toggleCompletion(choreId: number, memberId: number, date: Date): "added" | "removed" {
  const dayStr = format(date, "yyyy-MM-dd");
  const existing = db()
    .prepare(
      "SELECT id FROM chore_completions WHERE chore_id = ? AND member_id = ? AND completed_for = ?"
    )
    .get(choreId, memberId, dayStr) as { id: number } | undefined;
  if (existing) {
    db().prepare("DELETE FROM chore_completions WHERE id = ?").run(existing.id);
    return "removed";
  } else {
    db()
      .prepare(
        "INSERT INTO chore_completions (chore_id, member_id, completed_for, completed_at) VALUES (?, ?, ?, ?)"
      )
      .run(choreId, memberId, dayStr, Math.floor(Date.now() / 1000));
    return "added";
  }
}

/** Verify a pending completion. Returns true on success. Rules:
 *  - Verifier must exist and be a parent.
 *  - Child completions: any parent may verify.
 *  - Parent completions: any OTHER parent may verify (peer rule).
 *  - If only one parent exists, they may self-verify (single-parent household fallback).
 */
export function verifyCompletion(completionId: number, verifierId: number): { ok: boolean; reason?: string } {
  const row = db()
    .prepare("SELECT * FROM chore_completions WHERE id = ?")
    .get(completionId) as ChoreCompletion | undefined;
  if (!row) return { ok: false, reason: "not_found" };
  if (row.verified_at) return { ok: false, reason: "already_verified" };

  const verifier = db().prepare("SELECT * FROM members WHERE id = ?").get(verifierId) as Member | undefined;
  if (!verifier) return { ok: false, reason: "verifier_unknown" };
  if (verifier.role !== "parent") return { ok: false, reason: "verifier_not_parent" };

  const doer = db().prepare("SELECT * FROM members WHERE id = ?").get(row.member_id) as Member | undefined;
  if (!doer) return { ok: false, reason: "doer_unknown" };

  const parentCount = (db().prepare("SELECT COUNT(*) as n FROM members WHERE role = 'parent'").get() as { n: number }).n;

  if (doer.role === "parent" && doer.id === verifier.id && parentCount > 1) {
    return { ok: false, reason: "self_verify_parent" };
  }

  db()
    .prepare("UPDATE chore_completions SET verified_at = ?, verified_by = ? WHERE id = ?")
    .run(Math.floor(Date.now() / 1000), verifierId, completionId);
  return { ok: true };
}

export function unverifyCompletion(completionId: number) {
  db()
    .prepare("UPDATE chore_completions SET verified_at = NULL, verified_by = NULL WHERE id = ?")
    .run(completionId);
}

/** Return the set of member IDs who may verify this completion. */
export function eligibleVerifiers(completion: ChoreCompletion): number[] {
  const parents = db()
    .prepare("SELECT * FROM members WHERE role = 'parent'")
    .all() as Member[];
  if (parents.length === 0) return [];
  if (parents.length === 1) return [parents[0].id]; // fallback
  // Otherwise: any parent who is not the doer.
  return parents.filter((p) => p.id !== completion.member_id).map((p) => p.id);
}

export function listPendingCompletions(): Array<ChoreCompletion & { chore: Chore }> {
  const rows = db()
    .prepare(
      `SELECT c.*, ch.title AS ch_title, ch.icon AS ch_icon, ch.points AS ch_points, ch.recurrence AS ch_recurrence, ch.active AS ch_active, ch.shared AS ch_shared, ch.created_at AS ch_created_at
       FROM chore_completions c JOIN chores ch ON ch.id = c.chore_id
       WHERE c.verified_at IS NULL
       ORDER BY c.completed_at DESC`
    )
    .all() as Array<
      ChoreCompletion & {
        ch_title: string;
        ch_icon: string | null;
        ch_points: number;
        ch_recurrence: string;
        ch_active: number;
        ch_shared: number;
        ch_created_at: number;
      }
    >;
  return rows.map((r) => ({
    id: r.id,
    chore_id: r.chore_id,
    member_id: r.member_id,
    completed_for: r.completed_for,
    completed_at: r.completed_at,
    verified_at: r.verified_at,
    verified_by: r.verified_by,
    chore: {
      id: r.chore_id,
      title: r.ch_title,
      icon: r.ch_icon,
      points: r.ch_points,
      recurrence: r.ch_recurrence,
      active: r.ch_active,
      shared: r.ch_shared,
      created_at: r.ch_created_at,
    },
  }));
}

export function streakFor(memberId: number, chores: ChoreWithAssignees[], today: Date): number {
  const assigned = chores.filter((c) => c.assignees.includes(memberId));
  if (assigned.length === 0) return 0;
  let streak = 0;
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const due = assigned.filter((c) => isDueOn(c, cursor));
    if (due.length === 0) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const dayStr = format(cursor, "yyyy-MM-dd");
    // Only VERIFIED completions count toward the streak.
    const rows = db()
      .prepare(
        `SELECT chore_id FROM chore_completions
         WHERE member_id = ? AND completed_for = ? AND verified_at IS NOT NULL`
      )
      .all(memberId, dayStr) as Array<{ chore_id: number }>;
    const completed = new Set(rows.map((r) => r.chore_id));
    const allDone = due.every((c) => completed.has(c.id));
    if (!allDone) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
