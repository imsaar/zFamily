"use server";

import { revalidatePath } from "next/cache";
import { createLocalEvent, deleteEvent, upsertEvent, getEvent } from "@/lib/events";
import { toggleCompletion, createChore, updateChore, deleteChore, verifyCompletion, unverifyCompletion, completeSharedChore, uncompleteSharedChore } from "@/lib/chores";
import { createMember, updateMember, deleteMember, setMemberPhoto, clearMemberPhoto } from "@/lib/members";
import { factoryReset } from "@/lib/db";
import { exportAllData, importAllData, saveBackupToDisk, listBackups, readStoredBackup, backupDir, defaultBackupDir } from "@/lib/backup";
import { checkForUpdate, runUpdate, restartApp } from "@/lib/updater";
import { createFeed, updateFeed, deleteFeed, syncDueFeeds } from "@/lib/ical";
import { createReward, updateReward, deleteReward, redeem } from "@/lib/rewards";
import { setSetting, getSetting } from "@/lib/settings";
import { computeCommute, geocodeAddress, searchAddresses, cityStateLabel, type CommuteMode } from "@/lib/commute";
import { cityStateFromText, looksLikeStreet } from "@/lib/address";
import { requirePin, setMemberPin, clearMemberPin, memberHasPin, verifyMemberPin } from "@/lib/pins";
import { searchCity } from "@/lib/geocode";
import { resetWeatherCache } from "@/lib/weather";
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
} from "@/lib/meals";
import type { Ingredient, MealSlot } from "@/lib/meals";
import type { MemberColor, MemberRole } from "@/lib/types";

function bust() {
  // Layout-scoped revalidation refreshes the shared kiosk chrome (header
  // + bottom nav) so things like the weather widget update immediately.
  revalidatePath("/", "layout");
  revalidatePath("/week");
  revalidatePath("/month");
  revalidatePath("/chores");
  revalidatePath("/meals");
  revalidatePath("/shopping");
  revalidatePath("/vote");
  revalidatePath("/event");
  revalidatePath("/settings");
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

/** Verify a parent PIN without mutating anything — used to unlock the Settings
 *  screen. Returns the same shape as the admin gate. */
export async function verifyAdminAction(admin?: AdminAuth) {
  return await requireParentAuth(admin);
}

export async function toggleChoreAction(choreId: number, memberId: number) {
  const today = new Date();
  toggleCompletion(choreId, memberId, today);
  bust();
}

// Common chores: anyone can complete once per period; we record who did it.
export async function completeSharedChoreAction(choreId: number, byMemberId: number) {
  const result = completeSharedChore(choreId, byMemberId, new Date());
  bust();
  return result;
}

export async function uncompleteSharedChoreAction(choreId: number) {
  uncompleteSharedChore(choreId, new Date());
  bust();
  return { ok: true as const };
}

export async function createEventAction(input: {
  member_ids: number[];
  title: string;
  start_ts: number;
  end_ts: number;
  all_day?: boolean;
  location?: string;
  address?: string | null;
  notes?: string;
  recurrence?: "none" | "daily" | "weekdays" | "weekly" | "monthly" | null;
  interval?: number;
  commute_mode?: CommuteMode;
}) {
  // Per-event transport mode (defaults to car); falls back to the saved default.
  const mode: CommuteMode = input.commute_mode ?? (getSetting("commute_mode") === "bus" ? "bus" : "car");
  const geoTarget = input.address?.trim() || input.location?.trim() || "";
  const commute_seconds = geoTarget ? await computeCommute(geoTarget, mode) : null;
  createLocalEvent({ ...input, commute_seconds, commute_mode: geoTarget ? mode : null });
  bust();
}

// Editing/deleting an event is parent-gated. Recurring instances arrive with a
// virtual id ("<baseId>::<ts>"); operate on the underlying base event.
export async function updateEventAction(
  id: string,
  patch: { title?: string; start_ts?: number; end_ts?: number; member_ids?: number[]; location?: string | null; address?: string | null; notes?: string | null; commute_mode?: CommuteMode },
  admin?: AdminAuth
) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  const baseId = id.split("::")[0];
  const existing = getEvent(baseId);
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const location = patch.location !== undefined ? patch.location : existing.location;
  const address = patch.address !== undefined ? patch.address : existing.address;
  // Recompute the commute when the location, address, OR transport mode changed.
  const mode: CommuteMode = patch.commute_mode ?? (existing.commute_mode === "bus" ? "bus" : "car");
  const modeChanged = patch.commute_mode !== undefined && patch.commute_mode !== (existing.commute_mode ?? "car");
  let commute_seconds = existing.commute_seconds ?? null;
  let commute_mode = existing.commute_mode ?? null;
  if (patch.location !== undefined || patch.address !== undefined || modeChanged) {
    const geoTarget = address?.trim() || location?.trim() || "";
    if (geoTarget) {
      commute_seconds = await computeCommute(geoTarget, mode);
      commute_mode = mode;
    } else {
      commute_seconds = null;
      commute_mode = null;
    }
  }
  upsertEvent({
    ...existing,
    title: patch.title ?? existing.title,
    start_ts: patch.start_ts ?? existing.start_ts,
    end_ts: patch.end_ts ?? existing.end_ts,
    member_ids: patch.member_ids !== undefined ? patch.member_ids : existing.member_ids,
    location,
    address,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    commute_seconds,
    commute_mode,
  });
  bust();
  return { ok: true as const };
}

export async function deleteEventAction(id: string, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  deleteEvent(id.split("::")[0]);
  bust();
  return { ok: true as const };
}

export async function createMemberAction(input: { name: string; nickname?: string | null; color: MemberColor; emoji?: string | null; role?: MemberRole }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  // Bootstrap exception: allow creation when there are no members yet.
  const hasAny = ((await import("@/lib/db")).db().prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n > 0;
  if (hasAny && !gate.ok) return gate;
  createMember(input);
  bust();
  return { ok: true as const };
}

// First-run family setup. Creates the whole family (and optional location) in
// one shot. Only permitted while the family is empty — the bootstrap window —
// so it can run without a parent PIN (no parent exists yet to authorize it).
export async function completeFamilySetupAction(input: {
  members: Array<{ name: string; nickname?: string | null; color: MemberColor; emoji?: string | null; role: MemberRole }>;
  weather?: { label: string; lat: string; lon: string; tz: string } | null;
}) {
  const hasAny = ((await import("@/lib/db")).db().prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n > 0;
  if (hasAny) return { ok: false as const, reason: "already_setup" as const };

  const clean = input.members.filter((m) => m.name.trim());
  if (clean.length === 0) return { ok: false as const, reason: "need_member" as const };
  if (!clean.some((m) => m.role === "parent")) return { ok: false as const, reason: "need_parent" as const };

  for (const m of clean) {
    createMember({ name: m.name.trim(), nickname: m.nickname?.trim() || null, color: m.color, emoji: m.emoji?.trim() || null, role: m.role });
  }
  if (input.weather && input.weather.lat && input.weather.lon) {
    setSetting("weather_label", input.weather.label);
    setSetting("weather_lat", input.weather.lat);
    setSetting("weather_lon", input.weather.lon);
    setSetting("weather_tz", input.weather.tz);
    resetWeatherCache();
  }
  bust();
  return { ok: true as const };
}

// iCal subscription feeds (Google Calendar "secret address in iCal format",
// Apple, Outlook, etc.). Config CRUD is parent-gated; refreshing is not, so the
// always-on kiosk poller and cron can trigger it freely.

export async function createIcalFeedAction(input: { name: string; url: string; member_id?: number | null; color?: string | null; interval_hours?: number }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  if (!input.name.trim() || !input.url.trim()) return { ok: false as const, reason: "missing_fields" as const };
  const id = createFeed(input);
  // Pull it in immediately so the calendar populates without waiting for the interval.
  await syncDueFeeds({ force: true, feedId: id });
  bust();
  return { ok: true as const, id };
}

export async function updateIcalFeedAction(id: number, patch: { name?: string; url?: string; member_id?: number | null; color?: string | null; interval_hours?: number; active?: number }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  updateFeed(id, patch);
  await syncDueFeeds({ force: true, feedId: id });
  bust();
  return { ok: true as const };
}

export async function deleteIcalFeedAction(id: number, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  deleteFeed(id);
  bust();
  return { ok: true as const };
}

/** Refresh feeds. `force` re-pulls every active feed now; otherwise only the
 *  ones whose interval has elapsed. Not gated — used by the kiosk poller. */
export async function syncIcalFeedsAction(opts?: { force?: boolean; feedId?: number }) {
  const r = await syncDueFeeds(opts);
  bust();
  return { ok: true as const, ...r };
}

// Wipe every family, chore, event, meal plan, reward, and setting, then drop
// back into the first-run setup workflow. Gated on a parent PIN.
export async function factoryResetAction(admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  factoryReset();
  resetWeatherCache();
  bust();
  return { ok: true as const };
}

// Full-database backup: export everything as JSON, or restore (replace all) from
// a backup. Parent-gated; the whole export includes PIN hashes and Google tokens.
export async function exportAllDataAction(admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  return { ok: true as const, backup: exportAllData() };
}

// Save a backup to disk (into the configured backup directory) instead of
// downloading it. Also list stored backups and restore from one.
export async function saveBackupToDiskAction(admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  const r = saveBackupToDisk();
  if (!r.ok) return { ok: false as const, reason: r.reason ?? "write_failed" };
  return { ok: true as const, name: r.name!, path: r.path!, bytes: r.bytes ?? 0 };
}

export async function listBackupsAction(admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  return { ok: true as const, dir: backupDir(), defaultDir: defaultBackupDir(), backups: listBackups() };
}

export async function restoreStoredBackupAction(name: string, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  const backup = readStoredBackup(name);
  if (!backup) return { ok: false as const, reason: "backup_not_found" };
  const r = importAllData(backup);
  if (!r.ok) return { ok: false as const, reason: r.reason ?? "import_failed" };
  resetWeatherCache();
  bust();
  return { ok: true as const, rows: r.rows ?? 0 };
}

// In-app software update (git pull + npm install + build) and service restart.
// Parent-gated. The restart password is piped to sudo and never stored/logged.
export async function checkForUpdateAction(admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  return await checkForUpdate();
}

export async function runUpdateAction(admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  return await runUpdate();
}

export async function restartAppAction(password: string, service: string, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  return await restartApp(password, service);
}

export async function importAllDataAction(backup: unknown, admin?: AdminAuth) {
  // Bootstrap exception: on a fresh/erased device (no members yet) restoring is
  // allowed without a parent PIN — there's no parent to authorize it. Once data
  // exists (restore from Settings), require parent auth.
  const hasAny = ((await import("@/lib/db")).db().prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n > 0;
  if (hasAny) {
    const gate = await requireParentAuth(admin);
    if (!gate.ok) return gate;
  }
  const r = importAllData(backup);
  if (!r.ok) return { ok: false as const, reason: r.reason ?? "import_failed" };
  resetWeatherCache();
  bust();
  return { ok: true as const, rows: r.rows ?? 0 };
}

export async function updateMemberAction(id: number, patch: { name?: string; nickname?: string | null; color?: MemberColor; emoji?: string | null; role?: MemberRole }, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  updateMember(id, patch);
  bust();
  return { ok: true as const };
}

// Upload/replace a member's headshot. `dataUrl` is a base64 data URL produced
// client-side (already resized). Admin-gated, with the same bootstrap
// exception as member creation so photos can be set on a brand-new family.
export async function setMemberPhotoAction(id: number, dataUrl: string, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  const hasPinnedParent = ((await import("@/lib/db")).db()
    .prepare("SELECT COUNT(*) as n FROM members WHERE role = 'parent' AND pin_hash IS NOT NULL")
    .get() as { n: number }).n > 0;
  if (hasPinnedParent && !gate.ok) return gate;

  const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m) return { ok: false as const, reason: "bad_image" as const };
  const mime = m[1];
  if (!mime.startsWith("image/")) return { ok: false as const, reason: "bad_image" as const };
  const data = Buffer.from(m[3], m[2] ? "base64" : "utf8");
  // Guard against runaway payloads (~1.5MB of raw bytes is plenty for a
  // client-resized headshot).
  if (data.length === 0 || data.length > 1_500_000) return { ok: false as const, reason: "bad_image" as const };
  setMemberPhoto(id, mime, data);
  bust();
  return { ok: true as const };
}

export async function clearMemberPhotoAction(id: number, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  clearMemberPhoto(id);
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
  shared?: boolean;
}, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  createChore(input);
  bust();
  return { ok: true as const };
}

export async function updateChoreAction(
  id: number,
  patch: { title?: string; icon?: string | null; points?: number; recurrence?: string; assignees?: number[]; shared?: boolean },
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
  // Any weather-related change drops the 10-min cache so the header
  // widget updates on the next render.
  if (key.startsWith("weather_")) resetWeatherCache();
  bust();
  return { ok: true as const };
}

// Adding a meal to the library is intentionally open — anyone at the kiosk can
// contribute a meal. Editing/deleting existing meals stays parent-gated.
export async function createMealAction(input: { name: string; icon?: string | null; notes?: string | null; ingredients: Ingredient[]; slots?: MealSlot[] }) {
  createMeal(input);
  bust();
  return { ok: true as const };
}

export async function updateMealAction(id: number, patch: { name?: string; icon?: string | null; notes?: string | null; ingredients?: Ingredient[]; slots?: MealSlot[] }, admin?: AdminAuth) {
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

export async function planAndShopAction(
  date: string,
  slot: MealSlot,
  mealId: number,
  ingredientIdxs?: number[]
) {
  setPlanSlot(date, slot, mealId);
  const n = addMealIngredientsToShopping(mealId, ingredientIdxs);
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

export async function proposeMealAction(mealId: number, slotType: MealSlot, memberId: number | null) {
  proposeMeal(mealId, slotType, memberId);
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

// Changing/removing an EXISTING PIN requires either the member's own current
// PIN (self-service) or a parent's authorization (so parents can reset a child
// who forgot theirs). Setting a FIRST PIN (none yet) is open — used by the
// first-launch setup gate.
async function pinChangeAllowed(memberId: number, currentPin: string | null | undefined, admin: AdminAuth | undefined): Promise<boolean> {
  if (!memberHasPin(memberId)) return true;
  if (currentPin && verifyMemberPin(memberId, currentPin)) return true;
  if (admin && (await requireParentAuth(admin)).ok) return true;
  return false;
}

export async function setMemberPinAction(memberId: number, newPin: string, currentPin?: string | null, admin?: AdminAuth) {
  if (!(await pinChangeAllowed(memberId, currentPin, admin))) {
    return { ok: false as const, reason: "pin_invalid" as const };
  }
  const result = setMemberPin(memberId, newPin);
  bust();
  return result;
}

export async function searchCityAction(query: string) {
  const results = await searchCity(query);
  return { results };
}

// Look up a typed place/address name → candidate addresses (for the event
// location and home-address fields).
export async function searchAddressAction(query: string) {
  const results = await searchAddresses(query);
  return { results: results.map((r) => ({ display: r.display })) };
}

// Set (or clear) the home address used as the commute origin; geocoded to
// coordinates on save. Parent-gated.
export async function setHomeAddressAction(address: string, admin?: AdminAuth) {
  const gate = await requireParentAuth(admin);
  if (!gate.ok) return gate;
  const a = address.trim();
  if (!a) {
    setSetting("home_address", "");
    setSetting("home_lat", "");
    setSetting("home_lon", "");
    bust();
    return { ok: true as const, cleared: true };
  }
  const geo = await geocodeAddress(a);
  if (!geo) return { ok: false as const, reason: "not_found" as const };
  setSetting("home_address", a);
  setSetting("home_lat", String(geo.lat));
  setSetting("home_lon", String(geo.lon));
  // Use the home location for weather too — label as "City, ST" (not the street
  // address). Timezone falls back to "auto" in the weather fetch if unset.
  setSetting("weather_lat", String(geo.lat));
  setSetting("weather_lon", String(geo.lon));
  // Prefer the geocoder's structured city/state; if it didn't return one, parse
  // the city/state out of what the user typed so we never fall back to a street.
  let label = cityStateLabel(geo);
  if (looksLikeStreet(label)) label = cityStateFromText(a) ?? label;
  setSetting("weather_label", label);
  resetWeatherCache();
  bust();
  return { ok: true as const, resolved: geo.display };
}

export async function clearMemberPinAction(memberId: number, currentPin?: string | null, admin?: AdminAuth) {
  if (!(await pinChangeAllowed(memberId, currentPin, admin))) {
    return { ok: false as const, reason: "pin_invalid" as const };
  }
  clearMemberPin(memberId);
  bust();
  return { ok: true as const };
}
