/* Question scoring, mastery & difficulty tracking */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

describe("question scoring (qMastery)", () => {
  it("is 0 for unseen questions", () => {
    expect(Core.qMastery(undefined)).toBe(0);
    expect(Core.qMastery({ seen: 0, correct: 0, wrong: 0 })).toBe(0);
  });

  it("never exceeds 1 no matter how many correct answers", () => {
    const m = Core.qMastery({ seen: 50, correct: 50, wrong: 0 });
    expect(m).toBeLessThanOrEqual(1);
    expect(m).toBeGreaterThan(0.99);
  });

  it("never drops below 0 for all-wrong histories", () => {
    expect(Core.qMastery({ seen: 6, correct: 0, wrong: 6 })).toBe(0);
  });

  it("rises with repeated success", () => {
    const one = Core.qMastery({ seen: 1, correct: 1, wrong: 0 });
    const three = Core.qMastery({ seen: 2, correct: 2, wrong: 0 });
    expect(three).toBeGreaterThan(one);
  });

  it("matches the scoring formula exactly (misses at half weight)", () => {
    // (correct - wrong/2) / max(2, seen*0.7)
    expect(Core.qMastery({ seen: 10, correct: 7, wrong: 3 })).toBeCloseTo(5.5 / 7);
    const base = Core.qMastery({ seen: 10, correct: 7, wrong: 3 });
    const afterWrong = Core.qMastery({ seen: 11, correct: 7, wrong: 4 });
    const afterRight = Core.qMastery({ seen: 11, correct: 8, wrong: 3 });
    expect(afterWrong).toBeLessThan(base);
    expect(afterRight).toBeGreaterThan(base);
  });
});

describe("difficulty tracking", () => {
  it("returns the prior for unseen questions", () => {
    expect(Core.qDifficulty(undefined)).toBeCloseTo(0.4);
    expect(Core.qDifficulty({ seen: 0 })).toBeCloseTo(0.4);
  });

  it("hard questions estimate above easy ones", () => {
    const hard = Core.qDifficulty({ seen: 20, correct: 4, wrong: 16 });
    const easy = Core.qDifficulty({ seen: 20, correct: 19, wrong: 1 });
    expect(hard).toBeGreaterThan(easy);
    expect(hard).toBeLessThanOrEqual(1);
    expect(easy).toBeGreaterThanOrEqual(0);
  });

  it("low-observation questions stay near the prior", () => {
    expect(Core.qDifficulty({ seen: 1, correct: 1, wrong: 0 })).toBeGreaterThan(0.3);
    expect(Core.qDifficulty({ seen: 1, correct: 1, wrong: 0 })).toBeLessThan(0.55);
  });
});
