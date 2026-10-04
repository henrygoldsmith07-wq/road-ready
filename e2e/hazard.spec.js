import { test, expect } from "@playwright/test";

async function freshApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
}

/**
 * Hazard session lifecycle regression. The flow is driven entirely by the
 * module's OBSERVABLE phase state (#view-hazard[data-phase]:
 * idle → intro → countdown → running → verdict → … → results), so this test
 * awaits state transitions instead of sleeping — no sleeps, no timing guesses.
 */
test.describe("hazard perception training", () => {
  test("home card opens the training, a run reaches results with timeline and verdict", async ({ page }) => {
    test.setTimeout(300_000);
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

    const view = page.locator("#view-hazard");
    // The home card launches the module (parent wires #fcHazard -> HazardUI.start()).
    await page.locator("#fcHazard").click();
    await expect(page.locator("#hzStage")).toBeVisible();
    await expect(view).toHaveAttribute("data-phase", "intro");

    // Intro overlay -> Start. Phase drives the flow; each transition is awaited.
    await page.locator("#hzGo").click();

    let scenario = 0;
    for (let guard = 0; guard < 14; guard++) {
      // State-machine-driven: act on whichever phase the session is in.
      await expect(view).toHaveAttribute("data-phase", /countdown|running|verdict|results/, { timeout: 20_000 });
      const phase = await view.getAttribute("data-phase");
      if (phase === "results") break; // run complete — do not demand another scenario
      if (phase !== "verdict") {
        await expect(view).toHaveAttribute("data-phase", "running", { timeout: 20_000 });
        // One deliberate response per scenario, during the running phase.
        await page.locator("#hzSlow").click();
        scenario++;
        await expect(view).toHaveAttribute("data-phase", "verdict", { timeout: 30_000 });
      }
      // The verdict overlay is the observable completion signal.
      await expect(page.locator("#hzVerdict")).not.toBeEmpty();
      await expect(page.locator("#hzTimeline .hz-tl-track")).toHaveCount(1);

      const next = page.locator("#hzNext");
      if (!(await next.isVisible().catch(() => false))) break; // results already reached
      await next.click();
    }

    // Results overlay: total + training-honest wording.
    await expect(view).toHaveAttribute("data-phase", "results", { timeout: 30_000 });
    await expect(page.locator("#hzAgain")).toBeVisible();
    const overlayText = await page.locator("#hzOverlay").textContent();
    expect(overlayText).toMatch(/\d+ \/ \d+/);
    expect(overlayText).toContain("training feedback");
    expect(scenario).toBeGreaterThanOrEqual(3);

    // The timeline and verdict text describe the last scenario.
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

  test("replaying a run completely resets previous state", async ({ page }) => {
    test.setTimeout(300_000);
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

    const view = page.locator("#view-hazard");
    await page.locator("#fcHazard").click();
    await expect(view).toHaveAttribute("data-phase", "intro");

    // Short first run: start, reach a verdict, then exit mid-session.
    await page.locator("#hzGo").click();
    await expect(view).toHaveAttribute("data-phase", "running", { timeout: 20_000 });
    await page.locator("#hzSlow").click();
    await expect(view).toHaveAttribute("data-phase", "verdict", { timeout: 30_000 });
    const firstVerdict = await page.locator("#hzVerdict").textContent();
    expect(firstVerdict.length).toBeGreaterThan(0);

    // Exit mid-session: everything must reset to idle, not linger.
    await page.locator("#hzQuit").click();
    await expect(view).toHaveAttribute("data-phase", "idle");

    // Start again: state must be fully clean — intro overlay, empty progress,
    // no stale verdict/timeline from the previous run.
    await page.locator("#fcHazard").click();
    await expect(view).toHaveAttribute("data-phase", "intro");
    await expect(page.locator("#hzVerdict")).toBeEmpty();
    await expect(page.locator("#hzTimeline")).toBeEmpty();
    await page.locator("#hzGo").click();
    await expect(view).toHaveAttribute("data-phase", "running", { timeout: 20_000 });
    await expect(page.locator("#hzProgress")).toContainText("1 /");
  });
});
