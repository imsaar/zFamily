import { db } from "./db";

export type Ingredient = { name: string; quantity?: string; unit?: string };

/** Human label for an ingredient's amount, combining quantity + unit
 *  (e.g. "2 lb", "1 cup", "3"). Returns null when neither is set. */
export function ingredientAmount(ing: Ingredient): string | null {
  const qty = ing.quantity?.trim();
  const unit = ing.unit?.trim();
  const label = [qty, unit].filter(Boolean).join(" ").trim();
  return label || null;
}

export type MealSlot = "breakfast" | "lunch" | "dinner";

export const ALL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export type Meal = {
  id: number;
  name: string;
  icon: string | null;
  notes: string | null;
  ingredients: Ingredient[];
  slots: MealSlot[]; // which meal times this is eligible for
  is_favorite: number;
  created_at: number;
};

export type PlanEntry = {
  id: number;
  meal_date: string; // YYYY-MM-DD
  slot: MealSlot;
  meal_id: number;
};

export type ShoppingItem = {
  id: number;
  name: string;
  quantity: string | null;
  checked: number;
  from_meal_id: number | null;
  created_at: number;
};

type MealRow = Omit<Meal, "ingredients" | "slots"> & { ingredients: string; slots: string | null };

function parseSlots(csv: string | null): MealSlot[] {
  // NULL/empty (legacy rows) means eligible for every slot.
  const parsed = (csv ?? "").split(",").map((s) => s.trim()).filter((s): s is MealSlot => (ALL_SLOTS as string[]).includes(s));
  return parsed.length ? parsed : [...ALL_SLOTS];
}

function rowToMeal(row: MealRow): Meal {
  return {
    ...row,
    ingredients: JSON.parse(row.ingredients),
    slots: parseSlots(row.slots),
    is_favorite: row.is_favorite ?? 0,
  };
}

export function toggleFavorite(id: number) {
  db().prepare("UPDATE meals SET is_favorite = 1 - COALESCE(is_favorite, 0) WHERE id = ?").run(id);
}

// Meal proposals — a future "wishlist" of dishes, tagged by meal-type. Lunch
// and dinner ideas are shared (member_id NULL) and the family votes on them;
// breakfast ideas are personal to the proposer (member_id set, no voting).
// Proposals are NOT tied to a date or plan slot — parents place them onto the
// plan from the slot picker when they choose.

export type Proposal = {
  id: number;
  meal_id: number;
  slot_type: MealSlot;
  member_id: number | null; // proposer, for personal breakfast; NULL for shared lunch/dinner
  created_at: number;
};

export type ProposalWithVotes = Proposal & {
  meal: Meal;
  votes: number[]; // member IDs
};

export function listProposals(): ProposalWithVotes[] {
  const proposals = db()
    .prepare("SELECT * FROM meal_proposals ORDER BY created_at DESC")
    .all() as Proposal[];
  if (proposals.length === 0) return [];
  const votes = db()
    .prepare(
      `SELECT proposal_id, member_id FROM meal_votes
       WHERE proposal_id IN (${proposals.map(() => "?").join(",")})`
    )
    .all(...proposals.map((p) => p.id)) as Array<{ proposal_id: number; member_id: number }>;
  const votesByProposal = new Map<number, number[]>();
  for (const v of votes) {
    if (!votesByProposal.has(v.proposal_id)) votesByProposal.set(v.proposal_id, []);
    votesByProposal.get(v.proposal_id)!.push(v.member_id);
  }
  const mealRows = db()
    .prepare(`SELECT * FROM meals WHERE id IN (${proposals.map(() => "?").join(",")})`)
    .all(...proposals.map((p) => p.meal_id)) as MealRow[];
  const mealById = new Map(mealRows.map((r) => [r.id, rowToMeal(r)]));
  return proposals
    .map((p) => {
      const meal = mealById.get(p.meal_id);
      if (!meal) return null;
      return { ...p, meal, votes: votesByProposal.get(p.id) ?? [] };
    })
    .filter((x): x is ProposalWithVotes => x !== null);
}

/** Add a dish to the idea pool. Breakfast ideas are personal (pass the
 *  proposer's memberId); lunch/dinner are shared (memberId null). De-dupes on
 *  (meal, slot_type, member). Returns the proposal id. */
export function proposeMeal(mealId: number, slotType: MealSlot, memberId: number | null): number {
  const existing = db()
    .prepare(
      `SELECT id FROM meal_proposals WHERE meal_id = ? AND slot_type = ? AND (member_id IS ? OR member_id = ?)`
    )
    .get(mealId, slotType, memberId, memberId) as { id: number } | undefined;
  if (existing) return existing.id;
  const now = Math.floor(Date.now() / 1000);
  const r = db()
    .prepare("INSERT INTO meal_proposals (meal_id, slot_type, member_id, created_at) VALUES (?, ?, ?, ?)")
    .run(mealId, slotType, memberId, now);
  return Number(r.lastInsertRowid);
}

export function removeProposal(id: number) {
  db().prepare("DELETE FROM meal_proposals WHERE id = ?").run(id);
}

export function castVote(proposalId: number, memberId: number) {
  const now = Math.floor(Date.now() / 1000);
  db()
    .prepare(
      `INSERT INTO meal_votes (proposal_id, member_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT(proposal_id, member_id) DO NOTHING`
    )
    .run(proposalId, memberId, now);
}

export function withdrawVote(proposalId: number, memberId: number) {
  db()
    .prepare("DELETE FROM meal_votes WHERE proposal_id = ? AND member_id = ?")
    .run(proposalId, memberId);
}

export function listMeals(): Meal[] {
  const rows = db().prepare("SELECT * FROM meals ORDER BY name").all() as MealRow[];
  return rows.map(rowToMeal);
}

export function getMeal(id: number): Meal | undefined {
  const row = db().prepare("SELECT * FROM meals WHERE id = ?").get(id) as MealRow | undefined;
  return row ? rowToMeal(row) : undefined;
}

function slotsToCsv(slots?: MealSlot[]): string {
  const valid = (slots ?? []).filter((s) => ALL_SLOTS.includes(s));
  return (valid.length ? valid : ALL_SLOTS).join(",");
}

export function createMeal(input: { name: string; icon?: string | null; notes?: string | null; ingredients: Ingredient[]; slots?: MealSlot[] }): number {
  const now = Math.floor(Date.now() / 1000);
  const r = db()
    .prepare(
      "INSERT INTO meals (name, icon, notes, ingredients, slots, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(input.name, input.icon ?? null, input.notes ?? null, JSON.stringify(input.ingredients), slotsToCsv(input.slots), now);
  return Number(r.lastInsertRowid);
}

export function updateMeal(
  id: number,
  patch: { name?: string; icon?: string | null; notes?: string | null; ingredients?: Ingredient[]; slots?: MealSlot[] }
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) { fields.push("name = ?"); values.push(patch.name); }
  if (patch.icon !== undefined) { fields.push("icon = ?"); values.push(patch.icon); }
  if (patch.notes !== undefined) { fields.push("notes = ?"); values.push(patch.notes); }
  if (patch.ingredients !== undefined) { fields.push("ingredients = ?"); values.push(JSON.stringify(patch.ingredients)); }
  if (patch.slots !== undefined) { fields.push("slots = ?"); values.push(slotsToCsv(patch.slots)); }
  if (fields.length === 0) return;
  values.push(id);
  db().prepare(`UPDATE meals SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteMeal(id: number) {
  db().prepare("DELETE FROM meals WHERE id = ?").run(id);
}

export function listPlanForRange(startDate: string, endDate: string): PlanEntry[] {
  return db()
    .prepare(
      "SELECT * FROM meal_plan_entries WHERE meal_date >= ? AND meal_date <= ? ORDER BY meal_date, slot"
    )
    .all(startDate, endDate) as PlanEntry[];
}

export function setPlanSlot(date: string, slot: MealSlot, mealId: number | null) {
  if (mealId === null) {
    db().prepare("DELETE FROM meal_plan_entries WHERE meal_date = ? AND slot = ?").run(date, slot);
    return;
  }
  db()
    .prepare(
      `INSERT INTO meal_plan_entries (meal_date, slot, meal_id) VALUES (?, ?, ?)
       ON CONFLICT(meal_date, slot) DO UPDATE SET meal_id = excluded.meal_id`
    )
    .run(date, slot, mealId);
}

export function listShoppingItems(): ShoppingItem[] {
  return db()
    .prepare("SELECT * FROM shopping_items ORDER BY checked, created_at DESC")
    .all() as ShoppingItem[];
}

export function addShoppingItem(input: { name: string; quantity?: string | null; from_meal_id?: number | null }): number {
  const now = Math.floor(Date.now() / 1000);
  const r = db()
    .prepare(
      "INSERT INTO shopping_items (name, quantity, checked, from_meal_id, created_at) VALUES (?, ?, 0, ?, ?)"
    )
    .run(input.name.trim(), input.quantity ?? null, input.from_meal_id ?? null, now);
  return Number(r.lastInsertRowid);
}

export function toggleShoppingItem(id: number) {
  db().prepare("UPDATE shopping_items SET checked = 1 - checked WHERE id = ?").run(id);
}

export function deleteShoppingItem(id: number) {
  db().prepare("DELETE FROM shopping_items WHERE id = ?").run(id);
}

export function clearCheckedShopping() {
  db().prepare("DELETE FROM shopping_items WHERE checked = 1").run();
}

/** Adds a meal's ingredients to the shopping list. When `indexes` is given,
 *  only those ingredient positions are added (lets the user pick which ones);
 *  omit it to add all. */
export function addMealIngredientsToShopping(mealId: number, indexes?: number[]): number {
  const meal = getMeal(mealId);
  if (!meal) return 0;
  const wanted = indexes ? new Set(indexes) : null;
  let n = 0;
  meal.ingredients.forEach((ing, i) => {
    if (wanted && !wanted.has(i)) return;
    addShoppingItem({ name: ing.name, quantity: ingredientAmount(ing), from_meal_id: mealId });
    n++;
  });
  return n;
}
