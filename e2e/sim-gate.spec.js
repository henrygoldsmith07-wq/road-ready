/* Pre-sim readiness gate: with a repeat hazard miss in history, tapping the
 * test-day row raises an advisory confirm naming the miss; dismissing stays
 * on the setup screen with no sitting started. The gate never blocks —
// accepting proceeds to Part 1. */
import { test, expect } from "@playwright/test";

async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
  return errors;
}

async function useGbPack(page) {
  await page.locator('#bottomNav button[data-nav="stats"]').click();
  await page.locator("#btnOpenSettings").click();
  await page.locator("#selStatePack").selectOption("UK");
  await page.locator("#btnSettingsDone").click();
  await page.locator('#bottomNav button[data-nav="exam"]').click();
}

const MISS = (date) => ({
  date, label: "Test-Day Simulation", pct: 0.88,
  correct: 44, total: 50, pass: false, official: true, tag: "test-day",
  theory: { correct: 44, total: 50, minCorrect: 43 },
  hazard: { pts: 30, max: 70, passPts: 41 },
});

test("repeat miss raises an advisory confirm; dismissing stays put", async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const key = "roadready.v1";
    const s = JSON.parse(localStorage.getItem(key));
    s.exams.push(
      { date: Date.now() - 2000, label: "Test-Day Simulation", pct: 0.88, correct: 44, total: 50, pass: false, official: true, tag: "test-day", theory: { correct: 44, total: 50, minCorrect: 43 }, hazard: { pts: 30, max: 70, passPts: 41 } },
      { date: Date.now() - 1000, label: "Test-Day Simulation", pct: 0.88, correct: 44, total: 50, pass: false, official: true, tag: "test-day", theory: { correct: 44, total: 50, minCorrect: 43 }, hazard: { pts: 30, max: 70, passPts: 41 } },
    );
    localStorage.setItem(key, JSON.stringify(s));
  });
  // Reload so the app picks up the seeded exams (in-memory state would
  // otherwise overwrite them on the next save).
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
  await useGbPack(page);

  const simRow = page.locator('.setup-row:has-text("Test-day simulation")');
  await expect(simRow).toBeVisible();
  // Fresh profile: theory readiness is 0%, so the theory line shows inline.
  await expect(simRow).toContainText("⚠");

  let dialogText = null;
  page.once("dialog", async (d) => {
    dialogText = d.message();
    await d.dismiss();
  });
  await simRow.click();
  expect(dialogText).toContain("theory readiness is");
  expect(dialogText).toContain("hazard is the repeat miss");
  expect(dialogText).toContain("Sit the full simulation anyway?");
  // Dismissed: still on the setup screen, no quiz started.
  await expect(page.locator("#view-setup.active")).toBeVisible();
  await expect(page.locator("#view-quiz.active")).toHaveCount(0);
  // The dismissal is logged locally for gate analytics.
  const logged = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).simGateEvents);
  expect(logged).toHaveLength(1);
  expect(logged[0].accepted).toBe(false);
  expect(logged[0].lines.join(" ")).toContain("repeat miss");

  expect(errors).toEqual([]);
});

test("accepting the advisory starts Part 1", async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate((m) => {
    const key = "roadready.v1";
    const s = JSON.parse(localStorage.getItem(key));
    s.exams.push(m);
    localStorage.setItem(key, JSON.stringify(s));
  }, MISS(Date.now() - 1000));
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
  await useGbPack(page);

  page.once("dialog", (d) => d.accept());
  await page.locator('.setup-row:has-text("Test-day simulation")').click();
  await expect(page.locator("#view-quiz.active")).toBeVisible();
  await expect(page.locator("#qCounter")).toContainText("Part 1");
  // The tap-through is logged locally for gate analytics.
  const logged = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).simGateEvents);
  expect(logged).toHaveLength(1);
  expect(logged[0].accepted).toBe(true);

  expect(errors).toEqual([]);
});
