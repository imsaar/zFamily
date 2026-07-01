import { test, expect } from "@playwright/test";

/** Smoke tests: every top-level route returns 200 and its distinctive
 *  content renders. Guards against regressions where a route breaks
 *  server-side (e.g. missing lib import). */
test.describe("Routes render", () => {
  const cases: Array<[string, string, RegExp]> = [
    ["/", "family home", /Verse of the day|Set up parent PINs/i],
    ["/week", "week view", /Today|SUN|MON/i],
    ["/month", "month view", /Today/i],
    ["/chores", "chore board", /Chores|Verify/i],
    ["/meals", "meals", /Meal plan|Library/i],
    ["/settings", "settings", /Family members/i],
    ["/me/1", "personal view (Mom)", /Mom.*view|Mom/i],
    ["/m", "mobile home", /Chores|Shopping/i],
    ["/m/shopping", "mobile shopping", /Shopping/i],
    ["/m/vote", "mobile vote", /Meal vote/i],
  ];

  for (const [route, name, matcher] of cases) {
    test(`renders ${name} (${route})`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(matcher, { timeout: 10_000 });
    });
  }
});
