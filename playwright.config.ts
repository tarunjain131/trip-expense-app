import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://postgres@localhost:5432/split_expense_test?schema=public";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Set PW_CHANNEL=msedge or chrome to reuse an installed browser instead of `playwright install`.
    channel: process.env.PW_CHANNEL || undefined,
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL || undefined } }],
  webServer: {
    // Production build against the dedicated test database.
    command: `npx prisma migrate deploy && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/trips`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_URL: E2E_DATABASE_URL },
  },
});
