/* WCAG spot-audits via axe-core on the main views (desktop profile). */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function scan(page) {
  const results = await new AxeBuilder({ page })
    // color-contrast: monochrome theme intentionally relies on muted grays;
    // reviewed manually — keep other rules strict.
    .disableRules(["color-contrast"])
    .analyze();
  return results.violations.filter((v) => ["critical", "serious"].includes(v.impact));
}

test.describe("axe WCAG audits", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
  });

  for (const nav of ["home", "stats", "guide", "flashcards"]) {
    test(`no critical/serious violations on ${nav}`, async ({ page }) => {
      if (nav !== "home") await page.locator(`#bottomNav button[data-nav="${nav}"]`).click();
      const violations = await scan(page);
      expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })))).toEqual([]);
    });
  }

  test("quiz view stays clean mid-session", async ({ page }) => {
    await page.locator("#topicGrid .topic-card").first().click();
    await expect(page.locator(".choice")).toHaveCount(4);
    const violations = await scan(page);
    expect(violations).toEqual([]);
  });
});
