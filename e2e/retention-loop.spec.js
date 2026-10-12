/* Retention loop: overdue spaced reviews are scheduled into the work itself.
 * The Today Plan promises the due questions, the session contains them (not
 * just fresh variants of their concepts), and the daily goal names due
 * reviews instead of letting a new-questions-only count declare victory. */
import { test, expect } from "@playwright/test";

async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
  return errors;
}

test("due-review session contains the due questions; goal names due reviews", async ({ page }) => {
  const errors = await boot(page);
  const dueIds = await page.evaluate(() => {
    const key = "roadready.v1";
    const s = JSON.parse(localStorage.getItem(key));
    const past = Date.now() - 5 * 864e5;
    const qs = QUESTIONS.slice(0, 4);
    s.qstats = s.qstats || {};
    for (const q of qs) {
      s.qstats[q.id] = { seen: 3, correct: 3, wrong: 0, lastSeen: past, sched: { due: past, ef: 2.5, interval: 1, reps: 1 } };
    }
    s.answered = 12;
    s.correctCount = 12;
    localStorage.setItem(key, JSON.stringify(s));
    return qs.map((q) => q.id);
  });
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

  // The plan promises the due questions, and the goal line names the reviews.
  await expect(page.locator("#planTitle")).toContainText(/due/i);
  await expect(page.locator("#dailyGoal .dg-label")).toContainText(/4 reviews? due/i);

  await page.locator("#btnPlanAction").click();
  await expect(page.locator("#view-quiz.active")).toBeVisible();
  // Every due question is in the session — following the plan reschedules
  // the exact questions the plan promised.
  const sessionIds = await page.evaluate(() => session.questions.map((q) => q.id));
  expect(sessionIds).toHaveLength(4);
  for (const id of dueIds) expect(sessionIds).toContain(id);

  expect(errors).toEqual([]);
});

test("goal stays honest when the count is complete but reviews are overdue", async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const key = "roadready.v1";
    const s = JSON.parse(localStorage.getItem(key));
    const past = Date.now() - 5 * 864e5;
    const qs = QUESTIONS.slice(0, 4);
    s.qstats = s.qstats || {};
    for (const q of qs) {
      s.qstats[q.id] = { seen: 3, correct: 3, wrong: 0, lastSeen: past, sched: { due: past, ef: 2.5, interval: 1, reps: 1 } };
    }
    // Hit the count with other questions answered "today" (local day, matching the app).
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    s.daily = { [today]: 10 };
    s.answered = 22;
    s.correctCount = 22;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");

  // The count is met, but overdue reviews keep the line from declaring victory.
  await expect(page.locator("#dailyGoal .dg-label")).toContainText(/Daily goal complete/i);
  await expect(page.locator("#dailyGoal .dg-label")).toContainText(/still due/i);

  expect(errors).toEqual([]);
});
