import { db } from "./db";
import type { Reward, RewardRedemption, Member } from "./types";

export function listRewards(activeOnly = true): Reward[] {
  const where = activeOnly ? "WHERE active = 1" : "";
  return db()
    .prepare(`SELECT * FROM rewards ${where} ORDER BY points_cost ASC`)
    .all() as Reward[];
}

export function getReward(id: number): Reward | undefined {
  return db().prepare("SELECT * FROM rewards WHERE id = ?").get(id) as Reward | undefined;
}

export function createReward(input: { title: string; icon?: string | null; description?: string | null; points_cost: number }): number {
  const now = Math.floor(Date.now() / 1000);
  const r = db()
    .prepare(
      "INSERT INTO rewards (title, icon, description, points_cost, active, created_at) VALUES (?, ?, ?, ?, 1, ?)"
    )
    .run(input.title, input.icon ?? null, input.description ?? null, Math.max(0, Math.round(input.points_cost)), now);
  return Number(r.lastInsertRowid);
}

export function updateReward(
  id: number,
  patch: { title?: string; icon?: string | null; description?: string | null; points_cost?: number; active?: number }
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) { fields.push("title = ?"); values.push(patch.title); }
  if (patch.icon !== undefined) { fields.push("icon = ?"); values.push(patch.icon); }
  if (patch.description !== undefined) { fields.push("description = ?"); values.push(patch.description); }
  if (patch.points_cost !== undefined) { fields.push("points_cost = ?"); values.push(Math.max(0, Math.round(patch.points_cost))); }
  if (patch.active !== undefined) { fields.push("active = ?"); values.push(patch.active); }
  if (fields.length === 0) return;
  values.push(id);
  db().prepare(`UPDATE rewards SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteReward(id: number) {
  db().prepare("UPDATE rewards SET active = 0 WHERE id = ?").run(id);
}

/** Sum of chore.points for VERIFIED completions by this member (lifetime).
 *  Returns net = earned − redeemed. */
export function pointsBalance(memberId: number): { earned: number; spent: number; balance: number } {
  const earned = (db()
    .prepare(
      `SELECT COALESCE(SUM(ch.points), 0) as n
       FROM chore_completions c JOIN chores ch ON ch.id = c.chore_id
       WHERE c.member_id = ? AND c.verified_at IS NOT NULL`
    )
    .get(memberId) as { n: number }).n;
  const spent = (db()
    .prepare(
      "SELECT COALESCE(SUM(points_spent), 0) as n FROM reward_redemptions WHERE member_id = ?"
    )
    .get(memberId) as { n: number }).n;
  return { earned, spent, balance: earned - spent };
}

export function redeem(input: { rewardId: number; memberId: number; approvedBy: number }): { ok: boolean; reason?: string } {
  const reward = getReward(input.rewardId);
  if (!reward || !reward.active) return { ok: false, reason: "reward_unavailable" };
  const member = db().prepare("SELECT * FROM members WHERE id = ?").get(input.memberId) as Member | undefined;
  if (!member) return { ok: false, reason: "member_unknown" };
  const approver = db().prepare("SELECT * FROM members WHERE id = ?").get(input.approvedBy) as Member | undefined;
  if (!approver || approver.role !== "parent") return { ok: false, reason: "approver_not_parent" };

  const { balance } = pointsBalance(input.memberId);
  if (balance < reward.points_cost) return { ok: false, reason: "insufficient" };

  db()
    .prepare(
      "INSERT INTO reward_redemptions (reward_id, member_id, approved_by, points_spent, redeemed_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(reward.id, member.id, approver.id, reward.points_cost, Math.floor(Date.now() / 1000));
  return { ok: true };
}

export function listRedemptions(memberId?: number, limit = 20): Array<RewardRedemption & { reward: Reward }> {
  const where = memberId ? "WHERE r.member_id = ?" : "";
  const args = memberId ? [memberId, limit] : [limit];
  const rows = db()
    .prepare(
      `SELECT r.*, w.title AS w_title, w.icon AS w_icon, w.description AS w_description,
              w.points_cost AS w_cost, w.active AS w_active, w.created_at AS w_created
       FROM reward_redemptions r JOIN rewards w ON w.id = r.reward_id
       ${where} ORDER BY r.redeemed_at DESC LIMIT ?`
    )
    .all(...args) as Array<
      RewardRedemption & {
        w_title: string;
        w_icon: string | null;
        w_description: string | null;
        w_cost: number;
        w_active: number;
        w_created: number;
      }
    >;
  return rows.map((r) => ({
    id: r.id,
    reward_id: r.reward_id,
    member_id: r.member_id,
    approved_by: r.approved_by,
    points_spent: r.points_spent,
    redeemed_at: r.redeemed_at,
    reward: {
      id: r.reward_id,
      title: r.w_title,
      icon: r.w_icon,
      description: r.w_description,
      points_cost: r.w_cost,
      active: r.w_active,
      created_at: r.w_created,
    },
  }));
}
