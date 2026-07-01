"use server";

import { revalidatePath } from "next/cache";
import { createLocalEvent, deleteEvent, upsertEvent, getEvent } from "@/lib/events";
import { toggleCompletion, createChore, updateChore, deleteChore, verifyCompletion, unverifyCompletion } from "@/lib/chores";
import { createMember, updateMember, deleteMember } from "@/lib/members";
import { createReward, updateReward, deleteReward, redeem } from "@/lib/rewards";
import { setSetting } from "@/lib/settings";
import { requirePin, setMemberPin, clearMemberPin, memberHasPin, verifyMemberPin } from "@/lib/pins";
import { searchCity } from "@/lib/geocode";
import {
  createMeal,
  updateMeal,
  deleteMeal,
  setPlanSlot,
  addShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  clearCheckedShopping,
  addMealIngredientsToShopping,
  toggleFavorite,
  proposeMeal,
  removeProposal,
  castVote,
  withdrawVote,
  applyWinnersToPlan,
} from "@/lib/meals";
import type { Ingredient, MealSlot } from "@/lib/meals";
import type { MemberColor, MemberRole } from "@/lib/types";

function bust() {
  revalidatePath("/");
  revalidatePath("/month");
  revalidatePath("/chores");
  revalidatePath("/meals");
  revalidatePath("/settings");
  revalidatePath("/m");
}

// Guard used by any admin action. `admin.by` must be a parent; if that parent
// has a PIN, the correct PIN must be provided. If no parents exist at all
// (fresh install), admin actions are allowed to bootstrap the family.
async function requireParentAuth(admin: { by: number; pin?: string | null } | undefined): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!admin) return { ok: false, reason: "admin_required" };
  const row = (await import("@/lib/db")).db()
    .prepare("SELECT id, role FROM members WHERE id = ?")
    .get(admin.by) as { id: number; role: string } | undefined;
  if (!row || row.role !== "parent") return { ok: false, reason: "not_parent" };
  const gate = requirePin(admin.by, admin.pin ?? null);
  if (!gate.ok) return { ok: false, reason: gate.reason ?? "pin_invalid" };
  return { ok: true };
}

export type AdminAuth = { by: number; pin?: string | null };

export async function toggleChoreAction(choreId: number, memberId: number) {
  const today = new Date();
  toggleCompletion(choreId, memberId, today);
  bust();
}

export async function createEventAction(input: {
  member_id: number | null;
  title: string;
  start_ts: number;
  end_ts: number;
  all_day?: boolean;
  location?: string;
  notes?: string;
  recurrence?: "none" | "weekly" | "monthly" | "quarterly" | null;
}) {
  createLocalEvent(input);
  bust();
}

export async function updateEventAction(
  id: string,
  patch: { title?: string; start_ts?: number; end_ts?: number; member_id?: number | null; location?: string | null; notes?: string | null }
) {
  const existing = getEvent(id);
  if (!existing) return;
  upsertEvent({
    ...existing,
    title: patch.title ?? existing.title,
    start_ts: patch.start_ts ?? existing.start_ts,
    end_ts: patch.end_ts ?? existing.end_ts,
    member_id: patch.member_id !== undefined ? patch.member_id : existing.member_id,
    location: patch.location !== undefined ? patch.location : existing.location,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
  });
  bust();
}

export async function deleteEventAction(id: string) {
  deleteEvent(id);
  bust();
}

export async function createMemberAction(input: { name: string; color: MemberColor; emoji?: string | null; role?: MemberRole }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  // Bootstrap exception: allow creation when there are no members yet.
  const hasAny = ((await import("@/lib/db")).db().prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n > 0;
  if (hasAny && !gate.ok) return gate;
  createMember(input);
  bust();
  return { ok: true as const };
}

export async function updateMemberAction(id: number, patch: { name?: string; color?: MemberColor; emoji?: string | null; role?: MemberRole }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  updateMember(id, patch);
  bust();
  return { ok: true as const };
}

export async function deleteMemberAction(id: number, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  deleteMember(id);
  bust();
  return { ok: true as const };
}

export async function createChoreAction(input: {
  title: string;
  icon?: string | null;
  points?: number;
  recurrence: string;
  assignees: number[];
}, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  createChore(input);
  bust();
  return { ok: true as const };
}

export async function updateChoreAction(
  id: number,
  patch: { title?: string; icon?: string | null; points?: number; recurrence?: string; assignees?: number[] },
  admin?: AdminAuth
) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  updateChore(id, patch);
  bust();
  return { ok: true as const };
}

export async function deleteChoreAction(id: number, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  deleteChore(id);
  bust();
  return { ok: true as const };
}

export async function updateSettingAction(key: string, value: string, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  setSetting(key, value);
  bust();
  return { ok: true as const };
}

export async function createMealAction(input: { name: string; icon?: string | null; notes?: string | null; ingredients: Ingredient[] }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  createMeal(input);
  bust();
  return { ok: true as const };
}

export async function updateMealAction(id: number, patch: { name?: string; icon?: string | null; notes?: string | null; ingredients?: Ingredient[] }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  updateMeal(id, patch);
  bust();
  return { ok: true as const };
}

export async function deleteMealAction(id: number, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  deleteMeal(id);
  bust();
  return { ok: true as const };
}

export async function setPlanSlotAction(date: string, slot: MealSlot, mealId: number | null) {
  setPlanSlot(date, slot, mealId);
  bust();
}

export async function planAndShopAction(date: string, slot: MealSlot, mealId: number) {
  setPlanSlot(date, slot, mealId);
  const n = addMealIngredientsToShopping(mealId);
  bust();
  return { added: n };
}

export async function addShoppingItemAction(input: { name: string; quantity?: string | null }) {
  if (!input.name.trim()) return;
  addShoppingItem(input);
  bust();
}

export async function toggleShoppingItemAction(id: number) {
  toggleShoppingItem(id);
  bust();
}

export async function deleteShoppingItemAction(id: number) {
  deleteShoppingItem(id);
  bust();
}

export async function clearCheckedShoppingAction() {
  clearCheckedShopping();
  bust();
}

export async function toggleFavoriteAction(mealId: number) {
  toggleFavorite(mealId);
  bust();
}

export async function proposeMealAction(mealId: number, weekStart: string) {
  proposeMeal(mealId, weekStart);
  bust();
}

export async function removeProposalAction(id: number) {
  removeProposal(id);
  bust();
}

export async function toggleVoteAction(proposalId: number, memberId: number, wantVote: boolean, pin?: string | null) {
  const gate = requirePin(memberId, pin);
  if (!gate.ok) return gate;
  if (wantVote) castVote(proposalId, memberId);
  else withdrawVote(proposalId, memberId);
  bust();
  return { ok: true as const };
}

export async function applyWinnersAction(weekStart: string, overwrite = false) {
  const n = applyWinnersToPlan(weekStart, overwrite);
  bust();
  return { filled: n };
}

// Verification & rewards

export async function verifyCompletionAction(completionId: number, verifierId: number, pin?: string | null) {
  const gate = requirePin(verifierId, pin);
  if (!gate.ok) return gate;
  const result = verifyCompletion(completionId, verifierId);
  bust();
  return result;
}

export async function unverifyCompletionAction(completionId: number) {
  unverifyCompletion(completionId);
  bust();
}

export async function createRewardAction(input: { title: string; icon?: string | null; description?: string | null; points_cost: number }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  createReward(input);
  bust();
  return { ok: true as const };
}

export async function updateRewardAction(id: number, patch: { title?: string; icon?: string | null; description?: string | null; points_cost?: number; active?: number }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  updateReward(id, patch);
  bust();
  return { ok: true as const };
}

export async function deleteRewardAction(id: number, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  deleteReward(id);
  bust();
  return { ok: true as const };
}

export async function redeemRewardAction(input: { rewardId: number; memberId: number; approvedBy: number; pin?: string | null }) {
  const gate = requirePin(input.approvedBy, input.pin);
  if (!gate.ok) return gate;
  const result = redeem(input);
  bust();
  return result;
}

// PIN management

export async function setMemberPinAction(memberId: number, newPin: string, currentPin?: string | null) {
  if (memberHasPin(memberId)) {
    if (!currentPin || !verifyMemberPin(memberId, currentPin)) {
      return { ok: false as const, reason: "pin_invalid" as const };
    }
  }
  const result = setMemberPin(memberId, newPin);
  bust();
  return result;
}

export async function searchCityAction(query: string) {
  const results = await searchCity(query);
  return { results };
}

export async function clearMemberPinAction(memberId: number, currentPin: string) {
  if (memberHasPin(memberId) && !verifyMemberPin(memberId, currentPin)) {
    return { ok: false as const, reason: "pin_invalid" as const };
  }
  clearMemberPin(memberId);
  bust();
  return { ok: true as const };
}
