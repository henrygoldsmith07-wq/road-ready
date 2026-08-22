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
    timeout: 15_000,
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } }, // mobile viewport/touch coverage
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
