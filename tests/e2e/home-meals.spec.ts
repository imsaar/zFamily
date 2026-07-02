import { test, expect } from "@playwright/test";
import { openDb } from "./helpers";

test.describe("Family home — today's meals", () => {
  const today = localDate();

  test.beforeEach(() => {
    const db = openDb();
    db.prepare("DELETE FROM meal_plan_entries WHERE meal_date = ?").run(today);
    db.close();
  });

  test("renders breakfast/lunch/dinner names when planned", async ({ page }) => {
    const db = openDb();
    // meal_id 1..8 are seeded on first boot.
    db.prepare("INSERT INTO meal_plan_entries (meal_date, slot, meal_id) VALUES (?, 'breakfast', 1)").run(today);
    db.prepare("INSERT INTO meal_plan_entries (meal_date, slot, meal_id) VALUES (?, 'lunch', 3)").run(today);
    db.prepare("INSERT INTO meal_plan_entries (meal_date, slot, meal_id) VALUES (?, 'dinner', 5)").run(today);
    db.close();

    await page.goto("/");
    const panel = page.getByText(/Today's meals/i).locator("..").locator("..");
    await expect(panel).toContainText("Oatmeal + berries");
    await expect(panel).toContainText("Turkey sandwich");
    await expect(panel).toContainText("Chicken tikka");
  });

  test("shows 'Not planned' for empty slots", async ({ page }) => {
    // Only dinner planned.
    const db = openDb();
    db.prepare("INSERT INTO meal_plan_entries (meal_date, slot, meal_id) VALUES (?, 'dinner', 6)").run(today);
    db.close();

    await page.goto("/");
    const panel = page.getByText(/Today's meals/i).locator("..").locator("..");
    await expect(panel).toContainText("Pasta bolognese");
    // Two "Not planned" rows for breakfast and lunch.
    await expect(panel.getByText(/Not planned/i)).toHaveCount(2);
  });
});

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
