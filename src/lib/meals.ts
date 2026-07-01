import { db } from "./db";
import { addDays, startOfWeek, format } from "date-fns";

export type Ingredient = { name: string; quantity?: string };

export type Meal = {
  id: number;
  name: string;
  icon: string | null;
  notes: string | null;
  ingredients: Ingredient[];
  is_favorite: number;
  created_at: number;
};

export type MealSlot = "breakfast" | "lunch" | "dinner";

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

type MealRow = Omit<Meal, "ingredients"> & { ingredients: string };

function rowToMeal(row: MealRow): Meal {
  return { ...row, ingredients: JSON.parse(row.ingredients), is_favorite: row.is_favorite ?? 0 };
}

export function toggleFavorite(id: number) {
  db().prepare("UPDATE meals SET is_favorite = 1 - COALESCE(is_favorite, 0) WHERE id = ?").run(id);
}

// Voting

export type Proposal = {
  id: number;
  meal_id: number;
  week_start: string;
  created_at: number;
};

export type ProposalWithVotes = Proposal & {
  meal: Meal;
  votes: number[]; // member IDs
};

export function nextWeekStart(from: Date = new Date()): string {
  // Week starts on Sunday
  const thisWeek = startOfWeek(from, { weekStartsOn: 0 });
  return format(addDays(thisWeek, 7), "yyyy-MM-dd");
}

export function listProposals(weekStart: string): ProposalWithVotes[] {
  const proposals = db()
    .prepare("SELECT * FROM meal_proposals WHERE week_start = ? ORDER BY created_at DESC")
    .all(weekStart) as Proposal[];
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

export function proposeMeal(mealId: number, weekStart: string): number {
  const now = Math.floor(Date.now() / 1000);
  const r = db()
    .prepare(
      `INSERT INTO meal_proposals (meal_id, week_start, created_at) VALUES (?, ?, ?)
       ON CONFLICT(meal_id, week_start) DO UPDATE SET meal_id = excluded.meal_id
       RETURNING id`
    )
    .get(mealId, weekStart, now) as { id: number };
  return r.id;
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

/** Applies the top-voted proposals to next week's dinner slots (Sun–Sat).
 *  Ties broken by earliest created_at. Skips slots that already have a meal
 *  unless overwrite=true. Returns how many slots were filled. */
export function applyWinnersToPlan(weekStart: string, overwrite = false): number {
  const proposals = listProposals(weekStart);
  if (proposals.length === 0) return 0;
  const ranked = [...proposals].sort((a, b) => {
    if (b.votes.length !== a.votes.length) return b.votes.length - a.votes.length;
    return a.created_at - b.created_at;
  });

  let filled = 0;
  const existing = db()
    .prepare(
      `SELECT meal_date, meal_id FROM meal_plan_entries
       WHERE slot = 'dinner' AND meal_date >= ? AND meal_date <= ?`
    )
    .all(weekStart, format(addDays(new Date(`${weekStart}T12:00:00`), 6), "yyyy-MM-dd")) as Array<{
      meal_date: string;
      meal_id: number;
    }>;
  const alreadyPlanned = new Set(existing.map((e) => e.meal_id));
  const busyDays = new Set(existing.map((e) => e.meal_date));

  const upsert = db().prepare(
    `INSERT INTO meal_plan_entries (meal_date, slot, meal_id) VALUES (?, 'dinner', ?)
     ON CONFLICT(meal_date, slot) DO UPDATE SET meal_id = excluded.meal_id`
  );

  let dayOffset = 0;
  for (const p of ranked) {
    if (dayOffset > 6) break;
    if (!overwrite && alreadyPlanned.has(p.meal_id)) continue;
    // find next open day
    while (dayOffset <= 6) {
      const dateStr = format(addDays(new Date(`${weekStart}T12:00:00`), dayOffset), "yyyy-MM-dd");
      if (!overwrite && busyDays.has(dateStr)) {
        dayOffset++;
        continue;
      }
      upsert.run(dateStr, p.meal_id);
      busyDays.add(dateStr);
      alreadyPlanned.add(p.meal_id);
      filled++;
      dayOffset++;
      break;
    }
  }
  return filled;
}

export function listMeals(): Meal[] {
  const rows = db().prepare("SELECT * FROM meals ORDER BY name").all() as MealRow[];
  return rows.map(rowToMeal);
}

export function getMeal(id: number): Meal | undefined {
  const row = db().prepare("SELECT * FROM meals WHERE id = ?").get(id) as MealRow | undefined;
  return row ? rowToMeal(row) : undefined;
}

export function createMeal(input: { name: string; icon?: string | null; notes?: string | null; ingredients: Ingredient[] }): number {
  const now = Math.floor(Date.now() / 1000);
  const r = db()
    .prepare(
      "INSERT INTO meals (name, icon, notes, ingredients, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(input.name, input.icon ?? null, input.notes ?? null, JSON.stringify(input.ingredients), now);
  return Number(r.lastInsertRowid);
}

export function updateMeal(
  id: number,
  patch: { name?: string; icon?: string | null; notes?: string | null; ingredients?: Ingredient[] }
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) { fields.push("name = ?"); values.push(patch.name); }
  if (patch.icon !== undefined) { fields.push("icon = ?"); values.push(patch.icon); }
  if (patch.notes !== undefined) { fields.push("notes = ?"); values.push(patch.notes); }
  if (patch.ingredients !== undefined) { fields.push("ingredients = ?"); values.push(JSON.stringify(patch.ingredients)); }
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

export function addMealIngredientsToShopping(mealId: number): number {
  const meal = getMeal(mealId);
  if (!meal) return 0;
  let n = 0;
  for (const ing of meal.ingredients) {
    addShoppingItem({ name: ing.name, quantity: ing.quantity ?? null, from_meal_id: mealId });
    n++;
  }
  return n;
}
