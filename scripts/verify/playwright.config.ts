import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "web.spec.mts",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  outputDir: process.env.VERIFY_PLAYWRIGHT_OUTPUT ?? "../../.verify/playwright",
  reporter: [["list"], ["json", { outputFile: process.env.VERIFY_PLAYWRIGHT_REPORT ?? "../../.verify/playwright-report.json" }]],
  use: {
    baseURL: process.env.VERIFY_WEB_URL,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    serviceWorkers: "block",
  },
});
