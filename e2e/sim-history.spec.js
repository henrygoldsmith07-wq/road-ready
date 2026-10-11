/* Test-day track record: a completed sitting survives a reload with both
 * sections intact, and exam history shows the theory + hazard bars plus a
 * trend line — not a bare theory percentage. */
import { test, expect } from "@playwright/test";

test("sim sitting renders per-section history with a trend line", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

  // Seed one completed sitting: theory cleared, hazard missed.
  await page.evaluate(() => {
    const key = "roadready.v1";
    const s = JSON.parse(localStorage.getItem(key));
    s.exams.push({
      date: Date.now(), label: "Test-Day Simulation", pct: 0.88,
      correct: 44, total: 50, pass: false, official: true, tag: "test-day",
      theory: { correct: 44, total: 50, minCorrect: 43 },
      hazard: { pts: 30, max: 70, passPts: 41 },
    });
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

  await page.locator('#bottomNav button[data-nav="stats"]').click();
  const trend = page.locator("#simTrend");
  await expect(trend).toBeVisible();
  await expect(trend).toContainText("1 sitting · 0 full passes · hazard is the repeat miss");
  const row = page.locator('#historyList li:has-text("Test-Day Simulation")');
  await expect(row).toBeVisible();
  await expect(row).toContainText("Theory 44/43 ✓ · Hazard 30/41 ✗");

  expect(errors).toEqual([]);
});
