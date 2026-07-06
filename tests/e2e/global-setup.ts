import { chromium } from "@playwright/test";
import { setKnownParentPins, seedTestFamily, openDb } from "./helpers";

/** Ensure the schema exists (by hitting the app once), seed a known test
 *  family, then set known PINs for Mom and Dad so tests can focus on the
 *  actual feature being tested. The app no longer auto-seeds a demo family. */
export default async function globalSetup() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Fire a request just to trigger schema creation (and starter meal/reward
  // seeds). If the app isn't up yet, retry a few times.
  for (let i = 0; i < 30; i++) {
    try {
      const r = await page.request.get("http://localhost:3011/settings", { timeout: 5000 });
      if (r.ok()) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  await browser.close();

  // Provision the fixed test family (no-op if it already exists).
  seedTestFamily();

  const db = openDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM members").get() as { n: number }).n;
  db.close();
  if (count === 0) throw new Error("Test family seed did not run");

  setKnownParentPins("1111", "2222");
}
