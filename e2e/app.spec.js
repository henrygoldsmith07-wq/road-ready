/* Road Ready E2E — core user journeys on desktop and mobile projects. */
import { test, expect } from "@playwright/test";

async function freshApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
}

test.describe("onboarding", () => {
  test("first run shows onboarding, skip lands on home", async ({ page }) => {
    await freshApp(page);
    await expect(page.locator("#onboarding")).toBeVisible();
    await page.click("#obSkip");
    await expect(page.locator("#onboarding")).toBeHidden();
    await expect(page.locator("#view-home")).toHaveClass(/active/);
    // second load: no onboarding
    await page.reload();
    await expect(page.locator("#onboarding")).toBeHidden();
  });
});

test.describe("practice flow", () => {
  test("answer a question, see feedback, finish session", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");

    // start a topic practice from the home topic grid (first card)
    await page.locator("#topicGrid .topic-card").first().click();
    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    await expect(page.locator(".choice")).toHaveCount(4);

    // answer with keyboard: press 1
    const before = await page.locator("#qCounter").textContent();
    await page.keyboard.press("1");
    await expect(page.locator("#feedback")).toBeVisible();
    await page.click("#btnNext");
    const after = await page.locator("#qCounter").textContent();
    expect(after).not.toBe(before);

    // stats updated
    await page.click("#btnQuit");
    await page.locator("#btnHomeR").click(); // back to home via results
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    const answered = Number(await page.locator("#ssAnswered").textContent());
    expect(answered).toBeGreaterThanOrEqual(1);
  });

  test("XP accrues and persists across reloads", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator("#topicGrid .topic-card").first().click();
    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    await expect(page.locator(".choice")).toHaveCount(4);
    await page.keyboard.press("1");
    await expect(page.locator("#feedback")).toBeVisible();
    await expect.poll(() => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("roadready.v1")); return s ? s.xp : 0; })).toBeGreaterThan(0);
    const xpText = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).xp);
    await page.reload();
    const xpAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).xp);
    expect(xpAfter).toBe(xpText);
  });
});

test.describe("mock exam", () => {
  test("quick check runs timed, submits, shows results", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="exam"]').click();
    await page.locator('.setup-row:has-text("Quick Check")').click();

    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    await expect(page.locator("#qTimer")).toBeVisible();
    const timer = await page.locator("#qTimer").textContent();
    expect(timer).toContain("10:00"); // 10 questions × 60 s

    // answer all 10 by mashing "1" — auto-advance in exam mode
    for (let i = 0; i < 12 && !(await page.locator("#view-results").evaluate((el) => el.classList.contains("active"))); i++) {
      await page.keyboard.press("1");
      await page.waitForTimeout(600); // auto-advance delay is 420ms
    }
    await expect(page.locator("#view-results")).toHaveClass(/active/);
    await expect(page.locator("#resultScore")).toContainText("%");
  });
});

test.describe("flashcards & settings", () => {
  test("flashcard flip + know-it tracking", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="flashcards"]').click();
    const counter = await page.locator("#fcCounter").textContent();
    expect(counter).toMatch(/1 \/ \d+/);
    await page.locator("#flashcard").click(); // flip
    await page.locator("#btnFcYes").click();  // mark known → advances
    const counter2 = await page.locator("#fcCounter").textContent();
    expect(counter2).toMatch(/^2 \//);
  });

  test("state pack exposes official sources in guide and dedicated practice", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    await page.locator("#selStatePack").selectOption("CA");
    await page.waitForTimeout(150);
    const pack = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).settings.statePack);
    expect(pack).toBe("CA");

    await page.locator('#bottomNav button[data-nav="guide"]').click();
    const guideSource = page.locator("#stateFacts .state-source");
    await expect(guideSource).toBeVisible();
    await expect(guideSource).toHaveAttribute("href", /dmv\.ca\.gov/);
    await expect(page.locator("#stateFacts .state-note")).not.toContainText("undefined");

    await page.locator('#bottomNav button[data-nav="practice"]').click();
    const stateDrill = page.locator('.setup-row:has-text("California (DMV) State Rules")');
    await expect(stateDrill).toBeVisible();
    await stateDrill.click();
    await page.keyboard.press("1");
    await expect(page.locator("#feedback")).toBeVisible();
    await expect(page.locator("#fbSource")).toBeVisible();
    await expect(page.locator("#fbSource")).toHaveAttribute("href", /dmv\.ca\.gov/);
  });

  test("test date builds a persistent daily plan", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator("#btnPlanAction").click();
    await expect(page.locator("#view-stats")).toHaveClass(/active/);
    const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await page.locator("#inpTestDate").fill(future);
    await page.locator("#inpTestDate").dispatchEvent("change");
    await page.locator('#bottomNav button[data-nav="home"]').click();
    await expect(page.locator("#planTitle")).toContainText("Test in");
    await expect(page.locator("#planMeta")).toContainText("/day");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).settings.testDate);
    expect(saved).toBe(future);
  });

  test("export produces a downloadable backup file", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#btnExport").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^road-ready-progress-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const fs = await import("node:fs");
    const bundle = JSON.parse(fs.readFileSync(path, "utf8"));
    expect(bundle.app).toBe("road-ready");
    expect(bundle.state).toBeTruthy();
  });

  test("import restores a backup round-trip", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    // seed progress
    await page.locator("#topicGrid .topic-card").first().click();
    await page.keyboard.press("1");
    await page.waitForTimeout(150);
    await page.locator('#bottomNav button[data-nav="stats"]').click();

    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#btnExport").click()]);
    const path = await download.path();

    // wipe, then import the backup
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    page.once("dialog", (d) => d.accept());
    await page.locator("#fileImport").setInputFiles(path);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).answered)).toBeGreaterThan(0);
  });
});

test.describe("PWA / offline", () => {
  test("manifest + service worker active; app reloads offline", async ({ page, context, browserName }) => {
    await page.goto("/");
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", "manifest.webmanifest");
    const res = await page.request.get("manifest.webmanifest");
    expect(res.ok()).toBe(true);

    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 15_000 }).catch(() => {});
    const swActive = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!(reg && (reg.active || reg.installing || reg.waiting));
    });
    expect(swActive).toBe(true);

    // WebKit in Playwright can't complete an offline reload reliably; the
    // offline-navigation guarantee is covered by the Chromium projects.
    if (browserName === "webkit") return;

    // give SW a beat to finish precaching, then go dark
    await page.waitForTimeout(800);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#app")).toBeVisible();
    await expect(page.locator(".brand-name")).toContainText("Road");
    await context.setOffline(false);
  });
});

test.describe("official simulation", () => {
  test("generic users see the unlock hint instead of an official row", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="exam"]').click();
    await expect(page.locator("#setupList .setup-row", { hasText: "Official Simulation" })).toHaveCount(0);
    await expect(page.locator("#setupList .setting-note")).toContainText("Pick your state");
  });

  test("CA selection locks the sim to the real blueprint and grades at the end", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    await page.locator("#selStatePack").selectOption("CA");
    await page.locator('#bottomNav button[data-nav="exam"]').click();

    const official = page.locator("#setupList .setup-row", { hasText: "California DMV-format simulation" });
    await expect(official).toContainText("46 questions");
    await expect(official).toContainText("38/46");
    await expect(official).toContainText("feedback at end");

    await official.click();
    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    await expect(page.locator("#qTimer")).toBeVisible();
    await expect(page.locator("#qTimer")).toContainText("46:00");

    // submit immediately: unanswered questions count wrong → fails the official bar
    page.once("dialog", (d) => d.accept());
    await page.locator("#btnQuit").click();
    await expect(page.locator("#view-results")).toHaveClass(/active/);
    await expect(page.locator("#resultTitle")).toHaveText("Not yet");
    await expect(page.locator("#resultSub")).toContainText("requires 38 of 46");

    // recorded in history as the official attempt
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    await expect(page.locator("#historyList")).toContainText("California DMV-format simulation");
  });

  test("UK selection offers the DVSA blueprint and grades on the 43/50 bar", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    await page.locator("#selStatePack").selectOption("UK");
    await page.locator('#bottomNav button[data-nav="exam"]').click();

    const official = page.locator("#setupList .setup-row", { hasText: "DVSA-format simulation" });
    await expect(official).toContainText("12 of 50");
    await expect(official).toContainText("86% official bar");

    await official.click();
    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    await expect(page.locator("#qTimer")).toBeVisible();
    await expect(page.locator("#qTimer")).toContainText("57:00");

    // submit immediately: unanswered questions count wrong → fails the official bar
    page.once("dialog", (d) => d.accept());
    await page.locator("#btnQuit").click();
    await expect(page.locator("#view-results")).toHaveClass(/active/);
    await expect(page.locator("#resultTitle")).toHaveText("Not yet");
    await expect(page.locator("#resultSub")).toContainText("requires 43 of 50");
    await expect(page.locator("#resultSub")).toContainText("starter run");  });
});

test.describe("prospective predictions", () => {
  test("freeze → reload → attach outcome keeps the snapshot immutable", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.locator("#obSkip").click();
    await page.locator("#topicGrid .topic-card").first().click();
    await page.locator("#bottomNav button[data-nav='stats']").click();
    await page.locator("#btnFreezePrediction").click();
    const frozen = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).predictions);
    expect(frozen).toHaveLength(1);
    expect(frozen[0].outcome).toBe(null);
    expect(frozen[0].readinessPct).toBeGreaterThanOrEqual(0);

    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.locator("#obSkip").click();
    await page.locator("#bottomNav button[data-nav='stats']").click();
    await expect(page.locator("#outcomeList .res-pending")).toHaveText("PENDING");

    page.once("dialog", (d) => d.accept());
    await page.locator("#btnOutcomePass").click();
    const decided = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).predictions);
    expect(decided).toHaveLength(1);
    expect(decided[0].outcome.result).toBe("pass");
    expect(decided[0].readinessPct).toBe(frozen[0].readinessPct);
    expect(decided[0].predictionCreatedAt).toBe(frozen[0].predictionCreatedAt);
  });
});

test.describe("practical drive log", () => {
  test("log a session → one next skill + readiness appear → persist reload", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator("#qaPractical").click();
    await expect(page.locator("#view-practical")).toHaveClass(/active/);
    await expect(page.locator("#drValue")).toHaveText("–"); // nothing logged yet

    // fill the form: rate three skills; the poorest one becomes the single next skill
    await page.locator('.pl-skill-row', { hasText: "mirrors" }).locator('button[aria-label*="good"]').click();
    await page.locator('.pl-skill-row', { hasText: "roundabout entry lane" }).locator('button[aria-label*="ok"]').click();
    await page.locator('.pl-skill-row', { hasText: "lane keeping" }).locator('button[aria-label*="poor"]').click();
    await page.locator(".chip", { hasText: "dry" }).click();
    await page.locator("#btnSaveSession").click();

    // readiness now blends theory with the fresh practical data
    await expect(page.locator("#drValue")).not.toHaveText("–");
    // single next-skill suggestion, not seven competency charts
    await expect(page.locator("#competencyList")).toHaveCount(0);
    await expect(page.locator("#nextFocus")).toContainText("lane keeping");

    // persisted
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem("roadready.v1")).practical.log);
    expect(log).toHaveLength(1);
    expect(log[0].skills.mirrors).toBe("good");
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await page.locator("#qaPractical").click();
    await expect(page.locator("#sessionList .pl-session")).toHaveCount(1);

    // delete works
    page.once("dialog", (d) => d.accept());
    await page.locator("#sessionList .pl-del").first().click();
    await expect(page.locator("#sessionList")).toContainText("No sessions logged yet");
  });
});

test.describe("accessibility basics", () => {
  test("skip link exists and quiz feedback is announced", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    await expect(page.locator(".skip-link")).toHaveCount(1);
    await page.locator("#topicGrid .topic-card").first().click();
    const ariaLive = await page.locator("#feedback").getAttribute("aria-live");
    expect(ariaLive).toBe("assertive");
    await page.keyboard.press("1");
    await expect(page.locator("#feedback")).toBeVisible();
  });

  test("no console errors during a full pass through views", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
    for (const nav of ["practice", "exam", "flashcards", "guide", "stats", "home"]) {
      await page.locator(`#bottomNav button[data-nav="${nav}"]`).click();
      await page.waitForTimeout(120);
    }
    expect(errors).toEqual([]);
  });
});
