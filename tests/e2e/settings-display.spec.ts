import { test, expect, type Page } from "@playwright/test";
import { readSetting, writeSetting } from "./helpers";

test.describe("Display settings save", () => {
  test.beforeEach(() => {
    writeSetting("hijri_offset", "0");
  });

  test("saves Hijri offset with PIN", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /🌙 Display/i }).click();
    await expect(page.getByRole("heading", { name: /Display & quiet hours/i })).toBeVisible();

    const hijri = page.getByLabel(/Hijri date correction/i).or(page.locator("input[type=number]").last());
    // The Hijri offset field is the last number input in DisplayTab.
    const numberInputs = page.locator("input[type=number]");
    const count = await numberInputs.count();
    await numberInputs.nth(count - 1).fill("2");

    await page.getByRole("button", { name: /^Save$/ }).click();

    await page.getByRole("button").filter({ hasText: /Tap to select/ }).first().click();
    await expect(page.getByText(/Mom's PIN/i)).toBeVisible();
    await enterPin(page, "1111");

    await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 10_000 });
    expect(readSetting("hijri_offset")).toBe("2");

    // Cached PIN should still be valid within 60s — subsequent save should
    // skip the picker.
    await numberInputs.nth(count - 1).fill("1");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 10_000 });
    expect(readSetting("hijri_offset")).toBe("1");
  });
});

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}
