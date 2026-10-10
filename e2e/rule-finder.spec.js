/* Road Ready E2E — Rule Finder search in the Study Guide. */
import { test, expect } from "@playwright/test";

async function freshApp(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#app")).toBeVisible();
}

async function openGuide(page) {
  await freshApp(page);
  if (await page.locator("#onboarding").isVisible()) page.click("#obSkip");
  await page.locator('#bottomNav button[data-nav="guide"]').click();
  await expect(page.locator("#view-guide")).toHaveClass(/active/);
}

test.describe("rule finder", () => {
  test("a rule query shows ranked matches that start a practice set", async ({ page }) => {
    await openGuide(page);
    await page.fill("#ruleSearch", "4-way stop");
    await expect(page.locator("#ruleSearchMeta")).toContainText("match");
    expect(await page.locator(".finder-item").count()).toBeGreaterThan(0);
    // the top match explains the queried rule
    await expect(page.locator(".finder-item").first()).toContainText("4-way stop");
    // one tap turns the matches into a real session, with back-nav to the guide
    await page.locator(".finder-practice").click();
    await expect(page.locator("#view-quiz")).toHaveClass(/active/);
    await page.click("#btnBack");
    await expect(page.locator("#view-guide")).toHaveClass(/active/);
  });

  test("a nonsense query is honestly empty, and clearing restores the guide", async ({ page }) => {
    await openGuide(page);
    await page.fill("#ruleSearch", "xyzzy qworty");
    await expect(page.locator("#ruleSearchMeta")).toContainText("No matches");
    expect(await page.locator(".finder-item").count()).toBe(0);
    await page.fill("#ruleSearch", "");
    await expect(page.locator("#ruleSearchMeta")).toBeHidden();
    // the static guide content is untouched
    await expect(page.locator("#guideUs")).toBeVisible();
  });
});
