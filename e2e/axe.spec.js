/* WCAG audits via axe-core on the main views — no disabled rules.
 *
 * The color-contrast exemption is gone on purpose: the monochrome theme is
 * audited in BOTH light and dark modes, so a contrast regression fails CI
 * instead of being waved through as "intentional". Muted colors are allowed;
 * unreadable ones are not.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function scan(page) {
  // Give the renderer a beat after interactions before sampling colors.
  await page.waitForTimeout(150);
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) => ["critical", "serious"].includes(v.impact));
}

async function freshApp(page, theme) {
  // Emulate reduced motion so CSS transitions never run while axe samples
  // colors — mid-transition colors are not the colors users rest on, and the
  // stylesheet already flattens animations under prefers-reduced-motion.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
  // Switch themes through the real toggle: applyTheme is synchronous, so the
  // DOM attributes and CSS custom properties are consistent before scanning.
  // (Seeding localStorage races the first paint on WebKit and samples colors
  // from two themes at once, which is not a state a user ever sees.)
  if (theme === "light") {
    await page.locator("#btnTheme").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }
  // WebKit can report stale compositing layers to axe right after a reload.
  // Force a full style/layout flush plus an extra frame before scanning.
  await page.evaluate(() => {
    void document.body.offsetWidth; // reflow
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

test.describe("axe WCAG audits", () => {
  for (const theme of [null, "light", "dark"]) {
    const label = theme ? `${theme} theme` : "default theme";
    test.describe(label, () => {
      test.beforeEach(async ({ page }) => {
        await freshApp(page, theme);
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
  }
});
