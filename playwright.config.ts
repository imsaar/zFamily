import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for zFamily. Runs against a locally-started Next.js dev
 * server on port 3011 with an isolated data dir at .data-e2e, so tests don't
 * touch the real family database.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3011",
    trace: "on-first-retry",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile",  use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "ZFAMILY_DATA_DIR=.data-e2e PORT=3011 npx next dev",
    port: 3011,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
