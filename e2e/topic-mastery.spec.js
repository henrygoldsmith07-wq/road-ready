/* REGRESSION: topic mastery display must show 100% when a topic is fully
   mastered (the UI used to divide Core.topicMastery by qs.length again,
   showing e.g. 5% for a perfectly mastered 20-question topic). */
import { test, expect } from "@playwright/test";

test.describe("topic mastery display", () => {
  test("fully mastered topic renders 100% on home and in stats", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    // seed full mastery over every 'signs' question + a little history
    await page.evaluate(() => {
      const ids = QUESTIONS.filter((q) => q.cat === "signs").map((q) => q.id);
      const raw = JSON.parse(localStorage.getItem("roadready.v1") || "null") || {};
      raw.v = 2;
      raw.qstats = {};
      for (const id of ids) raw.qstats[id] = { seen: 6, correct: 6, wrong: 0 };
      raw.answered = ids.length * 2;
      raw.correctCount = ids.length * 2;
      localStorage.setItem("roadready.v1", JSON.stringify(raw));
      return ids.length;
    });
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

    // HOME: the Signs topic card must read exactly 100% mastery
    const signsCard = page.locator("#topicGrid .topic-card", { hasText: "Signs & Signals" });
    await expect(signsCard.locator(".topic-foot")).toContainText("100% mastery");

    // STATS: mastery-by-topic row must also read 100%
    await page.locator('#bottomNav button[data-nav="stats"]').click();
    const row = page.locator("#masteryList .mastery-row", { hasText: "Signs" });
    await expect(row).toContainText("100%");
  });

  test("a partially mastered topic stays strictly below 100%", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => {
      const ids = QUESTIONS.filter((q) => q.cat === "signs").map((q) => q.id);
      const raw = JSON.parse(localStorage.getItem("roadready.v1") || "null") || {};
      raw.v = 2;
      raw.qstats = {};
      // master all but ONE question of the topic
      ids.slice(0, -1).forEach((id) => { raw.qstats[id] = { seen: 6, correct: 6, wrong: 0 }; });
      localStorage.setItem("roadready.v1", JSON.stringify(raw));
    });
    await page.reload();
    if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

    // concept coverage < 1 → must NOT display 100%
    const pctText = await page
      .locator("#topicGrid .topic-card", { hasText: "Signs & Signals" })
      .locator(".topic-foot")
      .textContent();
    const pct = Number(pctText.match(/(\d+)% mastery/)?.[1]);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});
