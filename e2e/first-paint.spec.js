/* The first-run card must appear before the application has finished loading.
 *
 * A new learner used to stare at an empty screen until every script in the
 * app had downloaded, parsed and run - the largest contentful paint waited
 * on the whole application. js/first-paint.js reveals the card during
 * parsing instead.
 *
 * This test holds the application's own boot script back and checks the card
 * is already on screen while it is still missing. That makes the behaviour
 * measurable instead of a matter of timing luck. */
import { test, expect } from "@playwright/test";

test.describe("first paint", () => {
  test("the first-run card is on screen before the app scripts have run", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message)));

    // Hold the app's boot script back so "before the app booted" is a
    // fact about the test, not a race.
    let release = () => {};
    const held = new Promise((resolve) => { release = resolve; });
    let appRequested = false;
    await page.route("**/js/app.js", async (route) => {
      appRequested = true;
      await held;
      await route.continue();
    });

    await page.goto("/", { waitUntil: "commit" });
    // The card is static markup, so it can be shown during parsing.
    await expect(page.locator("#onboarding")).toBeVisible({ timeout: 10_000 });
    // And it was visible before the application's boot script arrived.
    expect(appRequested).toBe(true);
    expect(errors).toEqual([]);

    release();
    // Once the app boots it populates the jurisdiction list and keeps the
    // card on screen for a learner who has not onboarded.
    await expect(page.locator("#obStatePack")).toHaveValue(/generic|UK|California|Texas|New York|Florida|Washington|Pennsylvania/i, { timeout: 15_000 });
  });

  test("a returning learner is not shown the first-run card", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("#onboarding")).toBeVisible();
    await page.click("#obSkip");
    await expect(page.locator("#onboarding")).toBeHidden();

    // Reload: the app has the last word and keeps the card hidden.
    await page.reload();
    await expect(page.locator("#onboarding")).toBeHidden();
  });

  test("a click before the app is ready is not lost", async ({ page }) => {
    // The card appears while the page is still parsing, so it can be tapped
    // before the app has attached its handlers. The tap must still work: a
    // learner who taps "Skip" and sees nothing would think the app froze.
    let release = () => {};
    const held = new Promise((resolve) => { release = resolve; });
    await page.route("**/js/app.js", async (route) => {
      await held;
      await route.continue();
    });

    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("#onboarding")).toBeVisible({ timeout: 10_000 });
    await page.click("#obSkip");

    release();
    // Once the app boots, the queued tap is replayed and the card closes.
    await expect(page.locator("#onboarding")).toBeHidden({ timeout: 15_000 });
    await expect(page.locator("#view-home")).toHaveClass(/active/);
  });
});
