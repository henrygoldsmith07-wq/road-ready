import { test, expect } from "@playwright/test";

async function freshApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
}

test.describe("hazard perception training", () => {
  // A full session is 12 scenarios x ~7s of animation; the journey is one
  // continuous run to the results overlay, well past the default 45s.
  test("home card opens the training, a run reaches results with timeline and verdict", async ({ page }) => {
    test.setTimeout(240_000);
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

    // The home card launches the module (parent wires #fcHazard -> HazardUI.start()).
    await page.locator("#fcHazard").click();
    await expect(page.locator("#view-hazard")).toBeVisible();
    await expect(page.locator("#hzStage")).toBeVisible();

    // Intro overlay -> Start.
    await page.locator("#hzGo").click();

    // Drive the whole session: once the countdown overlay drops, press SLOW
    // once per scenario, then advance each verdict overlay with Continue.
    const slow = page.locator("#hzSlow");
    const next = page.locator("#hzNext");
    const again = page.locator("#hzAgain");
    let clicked = false;
    for (let guard = 0; guard < 220; guard++) {
      if (await again.isVisible().catch(() => false)) break;
      if (await next.isVisible().catch(() => false)) {
        await next.click();
        clicked = false;
        continue;
      }
      if (!clicked && (await page.locator("#hzOverlay.show").count()) === 0) {
        await slow.click().catch(() => {});
        clicked = true;
      }
      await page.waitForTimeout(300);
    }

    // Results overlay: total + training-honest wording.
    await expect(page.locator("#hzAgain")).toBeVisible();
    const overlayText = await page.locator("#hzOverlay").textContent();
    expect(overlayText).toMatch(/\d+ \/ \d+/);
    expect(overlayText).toContain("training feedback");

    // The timeline element and verdict text appear for the last scenario.
    await expect(page.locator("#hzTimeline .hz-tl-track")).toHaveCount(1);
    await expect(page.locator("#hzTimeline .hz-tl-text")).toContainText(/Developing window: \d+\.\ds to \d+\.\ds/);
    await expect(page.locator("#hzVerdict")).not.toBeEmpty();

    // Accessible list exists and describes the developing hazard + timeline.
    const access = page.locator("#hzAccessibleList");
    await expect(access).toBeAttached();
    await expect(access).toContainText("Developing hazard:");
    await expect(access).toContainText("Early clues:");
    await expect(access).toContainText("Timeline:");
    await expect(access).toContainText("Developing window:");
  });
});
