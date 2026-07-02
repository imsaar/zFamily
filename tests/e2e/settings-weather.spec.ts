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

  test("header widget updates after changing city", async ({ page }) => {
    // Start with SF in the header.
    writeSetting("weather_label", "San Francisco");
    writeSetting("weather_lat", "37.7749");
    writeSetting("weather_lon", "-122.4194");
    writeSetting("weather_tz", "America/Los_Angeles");

    await page.goto("/week");
    await expect(page.locator("header")).toContainText(/San Francisco/);

    // Change city in settings.
    await page.goto("/settings");
    await page.getByRole("button", { name: /🌤️ Weather/i }).click();
    await page.locator("input").nth(1).fill("Reykjavík");
    await page.locator("input").nth(2).fill("64.1466"); // lat
    await page.locator("input").nth(3).fill("-21.9426"); // lon
    await page.locator("input").nth(4).fill("Atlantic/Reykjavik"); // tz

    await page.getByRole("button", { name: /^Save$/ }).click();
    await page.getByRole("button").filter({ hasText: /Tap to select/ }).first().click();
    await enterPin(page, "1111");
    await expect(page.getByText(/✓ Saved/i)).toBeVisible({ timeout: 10_000 });

    // Navigate away and back — the header should now show Reykjavík.
    await page.goto("/week");
    await expect(page.locator("header")).toContainText(/Reykjavík/, { timeout: 10_000 });
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
