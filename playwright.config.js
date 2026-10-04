import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:8321",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node serve.js",
    port: 8321,
    reuseExistingServer: !process.env.CI,
    // On slow machines node startup alone can exceed 15s, which turns device
    // overhead into a web-server failure before any test runs.
    timeout: 60_000,
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    // WebKit/mobile drivers on slower hardware resolve elements fine but have
    // slow action round trips; the project-level timeout stops device overhead
    // from masquerading as test failures (the desktop timeout stays tight).
    { name: "mobile-safari", use: { ...devices["iPhone 13"] }, timeout: 120_000 }, // mobile viewport/touch coverage
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, timeout: 120_000 },
  ],
});
