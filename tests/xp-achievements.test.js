/* XP economy, levels & achievements */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

describe("XP & levels", () => {
  it("correct answers are worth more than wrong ones", () => {
    expect(Core.xpForAnswer(true)).toBe(10);
    expect(Core.xpForAnswer(false)).toBe(2);
  });

  it("level 1 starts at 0 XP with a 100-XP bar", () => {
    const l = Core.levelFor(0);
    expect(l.lvl).toBe(1);
    expect(l.into).toBe(0);
    expect(l.need).toBe(100);
  });

  it("crosses into level 2 at exactly 100 XP", () => {
    expect(Core.levelFor(99).lvl).toBe(1);
    const l = Core.levelFor(100);
    expect(l.lvl).toBe(2);
    expect(l.into).toBe(0);
    expect(l.need).toBe(150); // next bar grows
  });

  it("bars keep growing and totals stay consistent", () => {
    let total = 0, prev = Core.levelFor(0), xp = 0;
    for (let i = 0; i < 200; i++) {
      xp += 10;
      const cur = Core.levelFor(xp);
      if (cur.lvl > prev.lvl) {
        expect(cur.lvl).toBe(prev.lvl + 1);
        expect(cur.need).toBeGreaterThan(0);
        prev = cur;
      }
      total = cur.lvl;
    }
    expect(total).toBeGreaterThan(3);
  });

  it("negative or garbage XP is clamped", () => {
    expect(Core.levelFor(-50).lvl).toBe(1);
    expect(Core.levelFor(undefined).lvl).toBe(1);
  });

  it("exam bonuses reward pass, more for perfect", () => {
    expect(Core.xpForExam(false, false)).toBe(0);
    expect(Core.xpForExam(true, false)).toBe(Core.XP_EXAM_PASS);
    expect(Core.xpForExam(true, true)).toBe(Core.XP_EXAM_PERFECT);
    expect(Core.XP_EXAM_PERFECT).toBeGreaterThan(Core.XP_EXAM_PASS);
  });
});

describe("achievements", () => {
  const snap = (over) => Object.assign({
    answered: 0, accuracy: 0, streak: 0, examsPassed: 0, hazardBest: 0,
    readinessPct: 0, allSignsKnown: false, perfectRun: false, sessionAnswers: 0,
  }, over);

  it("fresh user has unlocked nothing", () => {
    expect(Core.evaluateAchievements(snap())).toEqual([]);
  });

  it("answer-count thresholds fire at exactly the boundary", () => {
    expect(Core.evaluateAchievements(snap({ answered: 9 }))).not.toContain("first-steps");
    expect(Core.evaluateAchievements(snap({ answered: 10 }))).toContain("first-steps");
    expect(Core.evaluateAchievements(snap({ answered: 99 }))).not.toContain("century");
    expect(Core.evaluateAchievements(snap({ answered: 100 }))).toContain("century");
  });

  it("sharpshooter needs both volume and accuracy", () => {
    expect(Core.evaluateAchievements(snap({ answered: 150, accuracy: 0.84 }))).not.toContain("sharp");
    expect(Core.evaluateAchievements(snap({ answered: 150, accuracy: 0.86 }))).toContain("sharp");
    expect(Core.evaluateAchievements(snap({ answered: 50, accuracy: 1 }))).not.toContain("sharp");
  });

  it("streaks unlock at 3 and 7 days", () => {
    expect(Core.evaluateAchievements(snap({ streak: 2 }))).not.toContain("streak3");
    expect(Core.evaluateAchievements(snap({ streak: 3 }))).toContain("streak3");
    expect(Core.evaluateAchievements(snap({ streak: 7 }))).toContain("streak7");
  });

  it("exam achievements track passes", () => {
    expect(Core.evaluateAchievements(snap({ examsPassed: 1 }))).toContain("pass");
    expect(Core.evaluateAchievements(snap({ examsPassed: 3 }))).toContain("consistent");
    expect(Core.evaluateAchievements(snap({ examsPassed: 2 }))).not.toContain("consistent");
  });

  it("hazard, signs, marathon, perfect run and readiness all have triggers", () => {
    expect(Core.evaluateAchievements(snap({ hazardPct: 0.7 }))).toContain("hawk");
    expect(Core.evaluateAchievements(snap({ hazardPct: 0.69 }))).not.toContain("hawk");
    expect(Core.evaluateAchievements(snap({ allSignsKnown: true }))).toContain("signs");
    expect(Core.evaluateAchievements(snap({ sessionAnswers: 100 }))).toContain("marathon");
    expect(Core.evaluateAchievements(snap({ perfectRun: true }))).toContain("perfect");
    expect(Core.evaluateAchievements(snap({ readinessPct: 80 }))).toContain("ready");
    expect(Core.evaluateAchievements(snap({ readinessPct: 79 }))).not.toContain("ready");
  });

  it("every catalogued achievement has a unique id and test", () => {
    const ids = new Set();
    Core.ACHIEVEMENTS.forEach((a) => {
      expect(typeof a.id).toBe("string");
      expect(typeof a.test).toBe("function");
      ids.add(a.id);
    });
    expect(ids.size).toBe(Core.ACHIEVEMENTS.length);
  });
});
