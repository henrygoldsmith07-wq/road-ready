/* Road Ready E2E — install prompt honesty: no dead Install button.
 *
 * No install prompt event fires in the test browser. On desktop/mobile-chrome
 * the Settings install row must stay hidden (a visible Install button with no
 * deferred prompt behind it would be a control that cannot work). On iOS
 * Safari — which never fires beforeinstallprompt — the row honestly shows
 * manual Share-menu steps with the Install button hidden instead.
 */
import { test, expect } from "@playwright/test";

test.describe("install prompt", () => {
  test("settings shows no dead install control", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("#app")).toBeVisible();    await expect(page.locator("html")).toHaveAttribute("data-app-ready", "1");
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    await page.locator("#btnOpenSettings").click();
    await expect(page.locator("#view-settings")).toHaveClass(/active/);
    if (testInfo.project.name === "mobile-safari") {
      await expect(page.locator("#installRow")).toBeVisible();
      await expect(page.locator("#btnInstall")).toBeHidden();
      await expect(page.locator("#installNote")).toContainText(/Share menu/i);
    } else {
      await expect(page.locator("#installRow")).toBeHidden();
      await expect(page.locator("#installNote")).toBeHidden();
    }
    // the surrounding settings card is undisturbed by the new markup
    await expect(page.locator("#btnExport")).toBeVisible();
    await expect(page.locator("#btnResetAll")).toBeVisible();
  });
});
