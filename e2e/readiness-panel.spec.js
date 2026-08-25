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
    await expect(page.locator("#rpBand")).toHaveText("Not Started");
    const list = await page.locator("#rpList").textContent();
    expect(list).toContain("Recommended today:");
    expect(list).toMatch(/\d+ questions/);
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
    expect(["Ready", "Nearly Ready"]).toContain(band);
    const list = await page.locator("#rpList").textContent();
    expect(list).toContain("Strong:");
  });
});
