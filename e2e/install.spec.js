/* Road Ready E2E — install prompt honesty: no dead Install button.
 *
 * No install prompt event fires in the test browser, so on desktop the
 * Settings install row must stay hidden. (A visible Install button with no
 * deferred prompt behind it would be a control that cannot work.)
 */
import { test, expect } from "@playwright/test";

test.describe("install prompt", () => {
  test("settings shows no install row without a browser prompt event", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("#app")).toBeVisible();
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    await page.locator("#btnOpenSettings").click();
    await expect(page.locator("#view-settings")).toHaveClass(/active/);
    await expect(page.locator("#installRow")).toBeHidden();
    await expect(page.locator("#installNote")).toBeHidden();
    // the surrounding settings card is undisturbed by the new markup
    await expect(page.locator("#btnExport")).toBeVisible();
    await expect(page.locator("#btnResetAll")).toBeVisible();
  });
});
