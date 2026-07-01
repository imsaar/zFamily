import { test, expect, type Page } from "@playwright/test";
import { readSetting, writeSetting } from "./helpers";

test.describe("Weather settings save", () => {
  test.beforeEach(() => {
    writeSetting("weather_label", "San Francisco");
  });

  test("saves label after PIN entry (the reported bug)", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /Family members/i })).toBeVisible();

    await page.getByRole("button", { name: /🌤️ Weather/i }).click();
    await expect(page.getByRole("heading", { name: /^Weather$/i })).toBeVisible();

    // Inputs on Weather tab: [0]=city search, [1]=label, [2]=lat, [3]=lon, [4]=tz.
    await page.locator("input").nth(1).fill("Zephyr Cove");

    await page.getByRole("button", { name: /^Save$/ }).click();

    // Parent picker dialog appears.
    const picker = page.getByText(/Which parent\?/i);
    await expect(picker).toBeVisible({ timeout: 5_000 });

    // Pick Mom by clicking the tile that contains her name (scoped to modal).
    await page.getByRole("button").filter({ hasText: /Tap to select/ }).first().click();

    await expect(page.getByText(/Mom's PIN/i)).toBeVisible({ timeout: 5_000 });
    await enterPin(page, "1111");

    await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 15_000 });
    expect(readSetting("weather_label")).toBe("Zephyr Cove");
  });

  test("rejects wrong PIN and allows retry", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: /🌤️ Weather/i }).click();
    await page.locator("input").nth(1).fill("Test Retry");
    await page.getByRole("button", { name: /^Save$/ }).click();

    await expect(page.getByText(/Which parent\?/i)).toBeVisible();
    await page.getByRole("button").filter({ hasText: /Tap to select/ }).first().click();

    await expect(page.getByText(/Mom's PIN/i)).toBeVisible();
    await enterPin(page, "9999");
    await expect(page.getByText(/Incorrect PIN/i)).toBeVisible({ timeout: 5_000 });

    await enterPin(page, "1111");
    await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 15_000 });
    expect(readSetting("weather_label")).toBe("Test Retry");
  });
});

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}
