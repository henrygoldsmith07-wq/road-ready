/* Progress statistics: readiness v2, topic stats, streaks, daily goal */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const bank = [
  { id: "a1", cat: "signs", q: "Q1?", choices: ["x", "y"], a: 0, why: "w" },
  { id: "a2", cat: "signs", q: "Q2?", choices: ["x", "y"], a: 0, why: "w" },
  { id: "b1", cat: "row", q: "Q3?", choices: ["x", "y"], a: 0, why: "w" },
  { id: "b2", cat: "row", q: "Q3b?", choices: ["x", "y"], a: 0, why: "w" },
];

describe("readiness (v2 algorithm)", () => {
  it("is 0 for a fresh user", () => {
    expect(Core.readiness(bank, {}, [])).toBe(0);
  });

  it("increases as questions are mastered and seen", () => {
    const r0 = Core.readiness(bank, {}, []);
    const half = {};
    bank.forEach((q) => { half[q.id] = { seen: 4, correct: 4, wrong: 0 }; });
    const rFull = Core.readiness(bank, half, []);
    expect(rFull).toBeGreaterThan(r0);

    const onlySome = { a1: { seen: 4, correct: 4, wrong: 0 } };
    const rPartial = Core.readiness(bank, onlySome, []);
    expect(rPartial).toBeGreaterThan(r0);
    expect(rPartial).toBeLessThan(rFull);
  });

  it("caps at 1", () => {
    const all = {};
    bank.forEach((q) => { all[q.id] = { seen: 40, correct: 40, wrong: 0 }; });
    expect(Core.readiness(bank, all, [])).toBeLessThanOrEqual(1);
  });

  it("recent mock exams pull readiness toward exam performance", () => {
    const solid = {};
    bank.forEach((q) => { solid[q.id] = { seen: 4, correct: 3, wrong: 1 }; });
    const noExams = Core.readiness(bank, solid, []);
    const strong = Core.readiness(bank, solid, [{ pct: 1 }, { pct: 1 }, { pct: 1 }]);
    const weak = Core.readiness(bank, solid, [{ pct: 0.3 }, { pct: 0.3 }, { pct: 0.3 }]);
    expect(strong).toBeGreaterThan(noExams);
    expect(weak).toBeLessThan(noExams);
    expect(strong).toBeLessThanOrEqual(1);
  });
});

describe("topic statistics", () => {
  it("topicMastery averages per-question mastery within a topic", () => {
    const stats = {
      a1: { seen: 4, correct: 4, wrong: 0 },
      a2: { seen: 4, correct: 0, wrong: 0 },
    };
    const signs = bank.filter((q) => q.cat === "signs");
    const m = Core.topicMastery(signs, stats);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(1);
  });

  it("catAccuracy returns null before any attempt, accuracy after", () => {
    const signs = bank.filter((q) => q.cat === "signs");
    expect(Core.catAccuracy(signs, {})).toBe(null);
    const acc = Core.catAccuracy(signs, {
      a1: { seen: 2, correct: 2, wrong: 0 },
      a2: { seen: 2, correct: 1, wrong: 1 },
    });
    expect(acc).toBeCloseTo(0.75);
  });
});

describe("streaks & daily goal", () => {
  it("first study day starts a streak of 1", () => {
    expect(Core.touchStreak({ count: 0, last: "" }, "2026-08-22")).toEqual({ count: 1, last: "2026-08-22" });
  });

  it("consecutive days increment; gaps reset", () => {
    expect(Core.touchStreak({ count: 4, last: "2026-08-21" }, "2026-08-22", "2026-08-21").count).toBe(5);
    expect(Core.touchStreak({ count: 4, last: "2026-08-19" }, "2026-08-22", "2026-08-21").count).toBe(1);
  });

  it("same-day repeats do not double-count", () => {
    expect(Core.touchStreak({ count: 3, last: "2026-08-22" }, "2026-08-22").count).toBe(3);
  });

  it("daily counts accumulate per date for the goal ring", () => {
    let d = Core.bumpDaily({}, "2026-08-22");
    d = Core.bumpDaily(d, "2026-08-22", 4);
    expect(Core.dailyCount(d, "2026-08-22")).toBe(5);
    expect(Core.dailyCount(d, "2026-08-21")).toBe(0);
    expect(Core.DAILY_GOAL).toBe(10);
  });
});

describe("test day study plan", () => {
  it("keeps the standard daily goal until a date is set", () => {
    const plan = Core.studyPlan(bank, {}, [], {}, "", "2026-08-23");
    expect(plan.status).toBe("no-date");
    expect(plan.dailyTarget).toBe(10);
    expect(plan.remainingToday).toBe(10);
  });

  it("turns unseen and weak questions into a date-based daily target", () => {
    const stats = {
      a1: { seen: 2, correct: 0, wrong: 2 },
      a2: { seen: 2, correct: 2, wrong: 0 },
    };
    const plan = Core.studyPlan(bank, stats, [], { "2026-08-23": 3 }, "2026-08-24", "2026-08-23");
    expect(plan.daysLeft).toBe(1);
    expect(plan.unseen).toBe(2);
    expect(plan.weak).toBe(1);
    expect(plan.dailyTarget).toBe(10); // never encourages less than the proven habit goal
    expect(plan.remainingToday).toBe(7);
    expect(plan.action).toBe("exam"); // no passed mock exam with a week to go
  });

  it("raises the target for a large bank and chooses weak-topic review", () => {
    const largeBank = Array.from({ length: 80 }, (_, i) => ({ id: `q${i}` }));
    const stats = { q0: { seen: 3, correct: 0, wrong: 3 } };
    const plan = Core.studyPlan(largeBank, stats, [{ pass: true }], {}, "2026-08-25", "2026-08-23");
    expect(plan.dailyTarget).toBe(41); // 79 unseen + two passes over the weak item, across 2 days
    expect(plan.action).toBe("review");
  });

  it("switches to test-day mode without producing negative workloads", () => {
    const plan = Core.studyPlan(bank, {}, [], { "2026-08-23": 25 }, "2026-08-23", "2026-08-23");
    expect(plan.status).toBe("today");
    expect(plan.action).toBe("exam");
    expect(plan.remainingToday).toBe(0);
  });
});
