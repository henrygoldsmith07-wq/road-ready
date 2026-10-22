/* Habit loop: daily goal + on-device reminder settings persist and drive home. */
import { test, expect } from "@playwright/test";

test("daily goal + reminder settings persist and drive the home screen", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "1");
  if (await page.locator("#onboarding").isVisible()) await page.click("#obSkip");
  await expect(page.locator("#view-home.active")).toBeVisible();

  // Seed some history so the reminder nudge offers itself.
  await page.evaluate(() => {
    const key = "roadready.v1";
    const raw = JSON.parse(localStorage.getItem(key));
    raw.answered = 3;
    raw.correctCount = 2;
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload();
  await expect(page.locator("#view-home.active")).toBeVisible();

  // Home nudge offers the reminder path.
  await expect(page.locator("#dgReminder")).toContainText("Turn on a daily reminder");

  // Settings controls exist with sane defaults.
  await page.locator('#bottomNav button[data-nav="stats"]').click();
  await page.locator("#btnOpenSettings").click();
  await expect(page.locator("#view-settings.active")).toBeVisible();
  await expect(page.locator("#selDailyGoal")).toHaveValue("10");
  await expect(page.locator("#chkReminder")).not.toBeChecked();
  await expect(page.locator("#inpReminderTime")).toHaveValue("19:00");

  // Change goal to 20 → persists + home bar follows.
  await page.locator("#selDailyGoal").selectOption("20");
  await expect
    .poll(async () => JSON.parse(await page.evaluate(() => localStorage.getItem("roadready.v1"))).settings.dailyGoal)
    .toBe(20);
  await page.locator("#btnSettingsDone").click();
  await page.locator('#bottomNav button[data-nav="home"]').click();
  await expect(page.locator("#dailyGoal .dg-label")).toContainText("0/20");

  // Enable reminder → persists with default time; home states it.
  await page.locator('#bottomNav button[data-nav="stats"]').click();
  await page.locator("#btnOpenSettings").click();
  await page.locator("#chkReminder").check();
  await expect
    .poll(async () => JSON.parse(await page.evaluate(() => localStorage.getItem("roadready.v1"))).settings.reminder.enabled)
    .toBe(true);
  await expect(page.locator("#reminderNote")).toContainText("7:00 PM");
  await page.locator("#btnSettingsDone").click();
  await page.locator('#bottomNav button[data-nav="home"]').click();
  await expect(page.locator("#dgReminder")).toContainText("Reminder on");

  expect(errors.filter((m) => !/Notification/i.test(m))).toEqual([]);
});
