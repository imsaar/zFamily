import { test, expect, type Page } from "@playwright/test";
import { openDb } from "./helpers";

/** Regression test for "clicking Mom/Dad verify pill does nothing" bug.
 *  A child (Aisha, id=3) completes chore #1 today; the completion enters
 *  pending state; a parent taps the verify pill and must be prompted for
 *  their PIN. */
test.describe("Chore verify", () => {
  test.beforeEach(() => {
    const db = openDb();
    const today = localDate();
    db.prepare("DELETE FROM chore_completions WHERE completed_for = ?").run(today);
    db.prepare(
      "INSERT INTO chore_completions (chore_id, member_id, completed_for, completed_at) VALUES (?, ?, ?, ?)"
    ).run(1, 3, today, Math.floor(Date.now() / 1000));
    db.close();
  });

  test("clicking verify pill opens Mom's PIN pad and verifies", async ({ page }) => {
    await page.goto("/chores");
    // Chores tab loads.
    await expect(page.locator("text=/^Chores$/").first()).toBeVisible({ timeout: 10_000 });

    // Find the pending row in Aisha's column and its verify pills.
    await expect(page.getByText(/Awaiting verification/i).first()).toBeVisible({ timeout: 10_000 });

    // The verify pills appear directly below the pending chore. Click the
    // first pill (Mom, id=1) — its accessible name is emoji + ✓.
    const verifyPills = page.getByRole("button", { name: /✓$/ });
    await expect(verifyPills.first()).toBeVisible();
    await verifyPills.first().click();

    // PIN pad should now appear for Mom.
    await expect(page.getByText(/Mom's PIN/i)).toBeVisible({ timeout: 5_000 });

    // Enter Mom's PIN.
    await enterPin(page, "1111");

    // The pending row disappears (chore is now verified).
    await expect(page.getByText(/Awaiting verification/i)).toHaveCount(0, { timeout: 10_000 });

    // DB should reflect the verification.
    const db = openDb();
    const today = localDate();
    const row = db.prepare(
      "SELECT verified_at, verified_by FROM chore_completions WHERE chore_id = 1 AND member_id = 3 AND completed_for = ?"
    ).get(today) as { verified_at: number | null; verified_by: number | null };
    db.close();
    expect(row.verified_at).not.toBeNull();
    expect(row.verified_by).toBe(1); // Mom
  });
});

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
