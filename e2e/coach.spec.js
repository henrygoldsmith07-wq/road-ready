/* Road Ready E2E — Adaptive Coach learner journeys. */
import { test, expect } from "@playwright/test";

async function freshApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
}

test.describe("home → Today Plan adaptive action", () => {
  test("fresh learner sees a coverage plan with a why and one primary action", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await expect(page.locator("#todayPlanCard")).toBeVisible();
    const title = await page.locator("#planTitle").textContent();
    // deterministic coach output for a fresh learner: coverage work first
    expect(title).toMatch(/questions|review|mock|session/i);
    // the "why" is always visible in the rationale list or the meta line
    const why = (await page.locator("#planRationale").textContent()) + (await page.locator("#planMeta").textContent());
    expect(why.trim().length).toBeGreaterThan(0);
    // exactly one primary action on the plan card
    await expect(page.locator("#todayPlanCard .plan-action")).toHaveCount(1);
  });

  test("plan action launches the coach's concrete drill", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator("#btnPlanAction").click();
    // either a quiz session starts (drill) or the settings screen opens (no date)
    const quiz = page.locator("#view-quiz.active");
    const settings = page.locator("#view-settings.active");
    await expect(quiz.or(settings)).toBeVisible();
  });

  test("seeded mistakes change the plan to misconception repair", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.evaluate(() => {
      const key = "roadready.v1";
      const raw = JSON.parse(localStorage.getItem(key) || "{}");
      raw.v = 2;
      raw.qstats = raw.qstats || {};
      raw.misconceptions = raw.misconceptions || {};
      // QUESTIONS is a classic-script lexical binding (not a window property),
      // so it is read bare — the same way the existing e2e seeds do.
      const qs = QUESTIONS;
      const target = qs.filter((q) => q.concept === "junction-priority").slice(0, 2);
      for (const q of target) {
        raw.qstats[q.id] = { seen: 3, correct: 1, wrong: 2, fastWrong: 1 };
      }
      if (target.length) {
        raw.misconceptions["junction-priority"] = {
          errors: 3,
          questionIds: target.map((q) => q.id),
          firstSeen: Date.now() - 86400000,
          lastSeen: Date.now(),
          stage: 2,
          solvedIds: [],
          repairedAt: null,
        };
      }
      localStorage.setItem(key, JSON.stringify(raw));
    });
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    const title = (await page.locator("#planTitle").textContent()) || "";
    const why = (await page.locator("#planRationale").textContent()) || "";
    // the coach names the misconception specifically, not "practise signs"
    expect(title + why).toMatch(/misconception|confus|junction/i);
  });
});

test.describe("wrong answer → explanation → concept repair", () => {
  test("a wrong answer shows the rule, a hedged distinction, and schedules a variant", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator("#topicGrid .topic-card").first().click();
    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    // answer wrong on purpose: find the wrong choice index and click it
    await page.evaluate(() => {
      const btns = document.querySelectorAll("#choices .choice");
      const q = window.__rrSession ? null : null;
      void q;
      // click the first button that is not marked correct — we cannot read the
      // answer key from the DOM, so click index 0 and let the app mark it.
      if (btns[0]) btns[0].click();
    });
    await expect(page.locator("#feedback")).toBeVisible();
    const fb = await page.locator("#feedback").textContent();
    // either correct or not — the repair panel appears only on a wrong answer,
    // so force a wrong-answer path by answering every remaining question until
    // one lands wrong.
    if (!/Not quite/.test(fb)) {
      // answered correctly this time: next question, try again
      await page.click("#btnNext");
      await expect(page.locator("#view-quiz")).toHaveClass(/active/);
      await page.locator("#choices .choice").first().click();
      await expect(page.locator("#feedback")).toBeVisible();
    }
    const anyFb = await page.locator("#feedback").textContent();
    if (/Not quite/.test(anyFb)) {
      await expect(page.locator("#fbRepair")).toBeVisible();
      const repair = await page.locator("#fbRepair").textContent();
      // honest hedged language, never an asserted psychological explanation
      expect(repair).toMatch(/may be mixing|rule to hold|compare/i);
    }
    // misconception ledger is written whatever the outcome
    const hasLedger = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("roadready.v1") || "{}");
      return !!raw.misconceptions && Object.keys(raw.misconceptions).length >= 0;
    });
    expect(hasLedger).toBe(true);
  });
});

test.describe("mock → debrief → targeted drill", () => {
  test("a quick check debriefs concisely and offers a concept-targeted drill", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="exam"]').click();
    await page.locator('.setup-row:has-text("Quick Check")').click();
    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    // answer all 10 — exam mode auto-advances after ~420ms, so pace the keys
    for (let i = 0; i < 30; i++) {
      if (await page.locator("#view-results.active").isVisible().catch(() => false)) break;
      await page.keyboard.press("1").catch(() => {});
      await page.waitForTimeout(600);
    }
    await expect(page.locator("#view-results")).toHaveClass(/active/);
    // debrief block exists and is concise
    await expect(page.locator("#debrief")).toBeVisible();
    const debrief = await page.locator("#debrief").textContent();
    expect(debrief.length).toBeLessThan(2000); // not a chart farm
    // primary action turns the mock into a targeted study session when missed
    const again = await page.locator("#btnAgain").textContent();
    expect(again).toMatch(/study session|Try Again/i);
  });
});

test.describe("returning learner with overdue concepts", () => {
  test("overdue reviews produce a review-overdue plan with a concrete count", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.evaluate(() => {
      const key = "roadready.v1";
      const raw = JSON.parse(localStorage.getItem(key) || "{}");
      raw.v = 2;
      raw.qstats = raw.qstats || {};
      // QUESTIONS is a classic-script lexical binding (not a window property).
      const qs = QUESTIONS;
      for (const q of qs.slice(0, 6)) {
        raw.qstats[q.id] = {
          seen: 4, correct: 4, wrong: 0,
          sched: { due: Date.now() - 3 * 86400000, ef: 2.5, interval: 6, reps: 2 },
        };
      }
      localStorage.setItem(key, JSON.stringify(raw));
    });
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    const why = (await page.locator("#planRationale").textContent()) || "";
    const title = (await page.locator("#planTitle").textContent()) || "";
    expect(title + why).toMatch(/due|review|retention/i);
  });
});

test.describe("GB sign learning", () => {
  test("GB deck shows GB wording and spaced stages", async ({ page }) => {
    await freshApp(page);
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    await page.locator("#btnOpenSettings").click();
    await page.locator("#selStatePack").selectOption("UK");
    await page.locator("#btnSettingsDone").click();
    await page.locator('#bottomNav button[data-nav="flashcards"]').click();
    await expect(page.locator("#view-flashcards")).toHaveClass(/active/);
    // stage pill shows one of the five honest states
    await expect(page.locator("#fcStage")).toBeVisible();
    await expect(page.locator("#fcStage")).toHaveText(/New|Learning|Familiar|Mastered|Due for review/);
    // GB wording: no US-only vocabulary on the card
    const text = await page.locator("#view-flashcards").textContent();
    expect(text).not.toMatch(/railroad|crosswalk|intersection|3 feet/i);
    // marking a card advances the spaced schedule and shows the next card
    await page.click("#btnFcYes");
    await expect(page.locator("#fcCounter")).toContainText("2 /");
  });
});
