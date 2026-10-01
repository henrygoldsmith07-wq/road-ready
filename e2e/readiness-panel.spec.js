import { test, expect } from "@playwright/test";

async function freshApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
}

test.describe("readiness panel", () => {
  test("fresh user sees Not Started band and today's recommendation", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await expect(page.locator("#readinessPanel")).toBeVisible();
    await expect(page.locator("#rpBand")).toContainText("Not Started");
    /* The single next action must live in the Today Plan card, not be restated
     * by a second control in the progress panel. */
    const title = await page.locator("#planTitle").textContent();
    expect(title).toMatch(/\d+ questions today|Set your test date|Set test date/);
    await expect(page.locator("#rpStart")).toHaveCount(0);
  });

  test("seeded mastery upgrades the band and lists strong topics", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.evaluate(() => {
      const key = "roadready.v1";
      const raw = JSON.parse(localStorage.getItem(key) || "{}");
      raw.v = 2;
      raw.qstats = raw.qstats || {};
      QUESTIONS.forEach((q) => { raw.qstats[q.id] = { seen: 8, correct: 8, wrong: 0 }; });
      localStorage.setItem(key, JSON.stringify(raw));
    });
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    const band = (await page.locator("#rpBand").textContent()).trim();
    expect(["Strong", "On Track"].some((label) => band.startsWith(label))).toBe(true);
    const list = await page.locator("#rpList").textContent();
    expect(list).toContain("Strong:");
  });
});
