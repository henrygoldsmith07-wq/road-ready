/* Test-day simulation: offered on the exam screen for packs whose real test
 * scores hazard perception (GB), launches the theory section as Part 1, and
 * leaving mid-sitting records nothing. */
import { test, expect } from "@playwright/test";

test("test-day simulation launches Part 1 and abandons cleanly", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "1");
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

  // GB pack: the real test scores hazard perception, so the sim is offered.
  await page.locator('#bottomNav button[data-nav="stats"]').click();
  await page.locator("#btnOpenSettings").click();
  await page.locator("#selStatePack").selectOption("UK");
  await page.locator("#btnSettingsDone").click();

  await page.locator('#bottomNav button[data-nav="exam"]').click();
  const simRow = page.locator('.setup-row:has-text("Test-day simulation")');
  await expect(simRow).toBeVisible();
  await expect(simRow).toContainText("one combined result");
  // Fresh profile: theory readiness is 0%, so the pre-sim gate raises its
  // advisory confirm first — accept it to reach Part 1 (the gate is advisory
  // and never blocks; the dismiss path is covered in sim-gate.spec.js).
  page.once("dialog", (d) => d.accept());
  await simRow.click();

  // Part 1 runs in the standard exam UI, labelled as the first half.
  await expect(page.locator("#view-quiz.active")).toBeVisible();
  await expect(page.locator("#qCounter")).toContainText("Part 1");
  await expect(page.locator(".choice")).toHaveCount(4);

  // Leaving mid-sitting records no exam: a sitting only counts finished.
  const before = await page.evaluate(
    () => (JSON.parse(localStorage.getItem("roadready.v1")).exams || []).length
  );
  page.once("dialog", (d) => d.accept());
  await page.locator("#btnBack").click();
  await expect(page.locator("#view-home.active")).toBeVisible();
  const after = await page.evaluate(
    () => (JSON.parse(localStorage.getItem("roadready.v1")).exams || []).length
  );
  expect(after).toBe(before);

  expect(errors).toEqual([]);
});
