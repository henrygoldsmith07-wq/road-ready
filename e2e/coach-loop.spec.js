/* Road Ready E2E — the coach loop surfaces: Concept Mastery Map, Weakness
   Centre, session summaries, and test-date plan composition. */
import { test, expect } from "@playwright/test";

async function freshApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
}

test.describe("Concept Mastery Map", () => {
  test("mastery rows open the concept map with honest states", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    const row = page.locator("#masteryList .mastery-row").first();
    await row.click();
    await expect(page.locator("#view-conceptmap")).toHaveClass(/active/);
    await expect(page.locator("#cmList .cm-card")).not.toHaveCount(0);
    // every concept shows one of the honest states
    const chip = page.locator("#cmList .cm-chip").first();
    await expect(chip).toHaveText(/Unseen|Seen once|Learning|Secure|Strong|Needs review|Recurring misconception/);
    // progressive disclosure: details are collapsed until opened
    await expect(page.locator("#cmList .cm-details").first()).toHaveJSProperty("open", false);
  });

  test("concept map lists plain statements, not a vanity percentage", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    await page.locator("#masteryList .mastery-row").first().click();
    await expect(page.locator("#cmStatements")).toBeVisible();
    const text = await page.locator("#cmStatements").textContent();
    // A fresh learner honestly sees the empty-state line; once attempted,
    // statements name concepts and counts — never a vanity "ready" score.
    expect(text).toMatch(/Nothing attempted|concept/i);
    expect(text).not.toMatch(/\d+% ready/);
  });
});

test.describe("Weakness Centre", () => {
  test("seeded mistakes group into solvable problems with actions", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("roadready.v1") || "{}");
      raw.v = 2;
      raw.qstats = raw.qstats || {};
      raw.misconceptions = raw.misconceptions || {};
      const qs = QUESTIONS.filter((q) => q.concept === "junction-priority").slice(0, 2);
      for (const q of qs) raw.qstats[q.id] = { seen: 4, correct: 1, wrong: 3, fastWrong: 1 };
      if (qs.length) {
        raw.misconceptions["junction-priority"] = {
          errors: 3, questionIds: qs.map((q) => q.id), stage: 2,
          firstSeen: Date.now() - 86400000, lastSeen: Date.now(),
          solvedIds: [], repairedAt: null,
        };
      }
      localStorage.setItem("roadready.v1", JSON.stringify(raw));
    });
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator("#qaReview").click();
    await expect(page.locator("#view-review")).toHaveClass(/active/);
    await expect(page.locator("#reviewSummary")).toContainText(/weakness|resolved|recurring/i);
    // the problem is grouped by concept, with concrete actions
    const group = page.locator(".review-group").first();
    await expect(group).toContainText(/Recurring mistakes|Slow but correct|Recent regressions|Overdue|Unseen/i);
    await expect(group.locator("button")).not.toHaveCount(0);
  });

  test("view rule reveals the verified explanation inline", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("roadready.v1") || "{}");
      raw.v = 2;
      raw.qstats = {};
      const qs = QUESTIONS.filter((q) => q.cat === "signs").slice(0, 2);
      for (const q of qs) raw.qstats[q.id] = { seen: 3, correct: 1, wrong: 2 };
      localStorage.setItem("roadready.v1", JSON.stringify(raw));
    });
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator("#qaReview").click();
    await expect(page.locator("#view-review")).toHaveClass(/active/);
    await page.locator(".rg-rule").first().click();
    await expect(page.locator(".rg-rule-note").first()).toBeVisible();
  });
});

test.describe("session summaries", () => {
  test("a practice session ends with what it changed", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator("#topicGrid .topic-card").first().click();
    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    // answer a few and finish
    for (let i = 0; i < 4; i++) {
      if (await page.locator("#view-results.active").isVisible().catch(() => false)) break;
      await page.locator("#choices .choice").first().click();
      await expect(page.locator("#feedback")).toBeVisible();
      await page.click("#btnNext");
    }
    await page.click("#btnQuit");
    await expect(page.locator("#view-results")).toHaveClass(/active/);
    await expect(page.locator("#sessionSummary")).toBeVisible();
    const text = await page.locator("#sessionSummary").textContent();
    expect(text).toMatch(/question/i);
    expect(text).toMatch(/correct/i);
    expect(text).not.toMatch(/guaranteed|will pass|exam ready/i);
  });
});

test.describe("test-soon plan composition", () => {
  test("a near test date shows plan components, not one bare activity", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("roadready.v1") || "{}");
      raw.v = 2;
      raw.qstats = {};
      const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      raw.settings = Object.assign(raw.settings || {}, { testDate: future });
      localStorage.setItem("roadready.v1", JSON.stringify(raw));
    });
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await expect(page.locator("#planTitle")).toContainText("Test in");
    const plan = await page.locator("#todayPlanCard").textContent();
    expect(plan).toMatch(/mixed questions|weak-concept drill|hazard/i);
  });
});
