import { chromium } from "@playwright/test";
import { setKnownParentPins, openDb } from "./helpers";

/** Ensure the DB is seeded (by hitting the app once), then set known PINs
 *  for Mom and Dad so tests can focus on the actual feature being tested. */
export default async function globalSetup() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Fire a request just to trigger the schema + seeds. If the app isn't up
  // yet, retry a few times.
  for (let i = 0; i < 30; i++) {
    try {
      const r = await page.request.get("http://localhost:3011/settings", { timeout: 5000 });
      if (r.ok()) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  await browser.close();

  // Confirm members are seeded.
  const db = openDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n;
  db.close();
  if (count === 0) throw new Error("Seed did not run");

  setKnownParentPins("1111", "2222");
}
