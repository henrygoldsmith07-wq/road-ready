/* Habit loop: customizable daily goal + on-device study reminders.
 *
 * The goal sizes the home goal bar, the dated study plan and the reminder
 * copy; the reminder fires at most once a day and only while enabled. All
 * scheduling inputs are pure Core helpers — the Notification/toast fan-out
 * lives in app.js and is deliberately not unit-tested here.
 */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const bank = [
  { id: "a1", cat: "signs", q: "Q1?", choices: ["x", "y"], a: 0, why: "w" },
  { id: "a2", cat: "signs", q: "Q2?", choices: ["x", "y"], a: 0, why: "w" },
];

describe("clampDailyGoal", () => {
  it("defaults to 10 and clamps to 5..30", () => {
    expect(Core.clampDailyGoal()).toBe(10);
    expect(Core.clampDailyGoal(null)).toBe(10);
    expect(Core.clampDailyGoal(1)).toBe(5);
    expect(Core.clampDailyGoal(99)).toBe(30);
    expect(Core.clampDailyGoal(20)).toBe(20);
    expect(Core.clampDailyGoal("15")).toBe(15); // numeric strings coerce, like every other numeric setting
    expect(Core.clampDailyGoal("lots")).toBe(10); // non-numeric never sneaks in
  });
});

describe("reminder settings survive the real pipeline", () => {
  it("defaults to disabled at 19:00", () => {
    const s = Core.defaultSettings();
    expect(s.dailyGoal).toBe(10);
    expect(s.reminder).toEqual({ enabled: false, time: "19:00", lastFired: "" });
  });

  it("sanitize keeps valid choices and repairs hostile ones", () => {
    const good = Core.migrateState({ v: 2, settings: { dailyGoal: 20, reminder: { enabled: true, time: "07:30", lastFired: "" } } }).state;
    expect(good.settings.dailyGoal).toBe(20);
    expect(good.settings.reminder).toEqual({ enabled: true, time: "07:30", lastFired: "" });

    const bad = Core.migrateState({ v: 1, settings: { dailyGoal: 500, reminder: { enabled: 1, time: "25:99", lastFired: "yesterday" } } }).state;
    expect(bad.settings.dailyGoal).toBe(30);
    expect(bad.settings.reminder).toEqual({ enabled: false, time: "19:00", lastFired: "" });
  });

  it("validReminderTime accepts 24-hour HH:MM only", () => {
    expect(Core.validReminderTime("19:00")).toBe(true);
    expect(Core.validReminderTime("07:30")).toBe(true);
    expect(Core.validReminderTime("7:30")).toBe(false);
    expect(Core.validReminderTime("24:00")).toBe(false);
    expect(Core.validReminderTime("")).toBe(false);
  });
});

describe("reminderDue", () => {
  const on = (over = {}) => ({ reminder: { enabled: true, time: "19:00", lastFired: "", ...over } });
  it("fires once per day, only when enabled and the time has passed", () => {
    expect(Core.reminderDue(on(), "2026-08-23", "19:00")).toBe(true);
    expect(Core.reminderDue(on(), "2026-08-23", "21:15")).toBe(true);
    expect(Core.reminderDue(on(), "2026-08-23", "18:59")).toBe(false);
    expect(Core.reminderDue(on(), "2026-08-23", "not-a-time")).toBe(false);
    expect(Core.reminderDue(on(), "2026-08-23", "25:00")).toBe(false);
    expect(Core.reminderDue(on({ lastFired: "2026-08-23" }), "2026-08-23", "21:15")).toBe(false);
    expect(Core.reminderDue(on({ lastFired: "2026-08-22" }), "2026-08-23", "21:15")).toBe(true);
    expect(Core.reminderDue(on({ enabled: false }), "2026-08-23", "21:15")).toBe(false);
    expect(Core.reminderDue({}, "2026-08-23", "21:15")).toBe(false);
  });
});

describe("streakAtRisk", () => {
  it("is true only for a live streak with nothing answered today", () => {
    const streak = { count: 4, last: "2026-08-22" };
    expect(Core.streakAtRisk(streak, {}, "2026-08-23", "2026-08-22")).toBe(true);
    expect(Core.streakAtRisk(streak, { "2026-08-23": 2 }, "2026-08-23", "2026-08-22")).toBe(false);
    expect(Core.streakAtRisk({ count: 4, last: "2026-08-20" }, {}, "2026-08-23", "2026-08-22")).toBe(false);
    expect(Core.streakAtRisk({ count: 0, last: "2026-08-22" }, {}, "2026-08-23", "2026-08-22")).toBe(false);
    expect(Core.streakAtRisk(null, {}, "2026-08-23", "2026-08-22")).toBe(false);
  });
});

describe("custom goal threads through planning", () => {
  it("studyPlan without a date aims at the chosen goal", () => {
    expect(Core.studyPlan(bank, {}, [], {}, "", "2026-08-23", 20).dailyTarget).toBe(20);
    expect(Core.studyPlan(bank, {}, [], {}, "", "2026-08-23").dailyTarget).toBe(10);
  });

  it("studyPlan with a distant date never drops below the chosen goal", () => {
    const p = Core.studyPlan(bank, {}, [], {}, "2026-12-23", "2026-08-23", 25);
    expect(p.dailyTarget).toBeGreaterThanOrEqual(25);
  });

  it("dailyStudyRecommendation without a date respects the chosen goal", () => {
    // A large unseen bank so the bank-size cap cannot bind either answer.
    const bigBank = Array.from({ length: 40 }, (_, i) => ({
      id: `g${i}`, cat: "signs", q: `Q${i}?`, choices: ["x", "y"], a: 0, why: "w",
    }));
    const base = { bank: bigBank, qstats: {}, exams: [], daily: {}, nowMs: Date.parse("2026-08-23T12:00:00Z"), today: "2026-08-23" };
    const small = Core.dailyStudyRecommendation({ ...base, dailyGoal: 5 });
    const big = Core.dailyStudyRecommendation({ ...base, dailyGoal: 30 });
    expect(big.questions).toBeGreaterThanOrEqual(small.questions);
    expect(small.questions).toBeGreaterThanOrEqual(5);
  });
});
