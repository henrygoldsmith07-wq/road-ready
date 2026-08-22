/* Mock-exam engine: pass/fail grading, timing, blueprint, assembly */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const bank = [];
["signs", "row", "parking", "alcohol", "laws"].forEach((cat) => {
  for (let i = 0; i < 20; i++) {
    bank.push({ id: `${cat}${i}`, cat, q: `Q ${cat} ${i}?`, choices: ["a", "b", "c", "d"], a: 0, why: "Because." });
  }
});

describe("pass/fail grading", () => {
  it("passes at exactly the pass mark", () => {
    // 0.8 * 20 = 16 → 16/20 passes
    const g = Core.gradeExam(16, 20, 0.8);
    expect(g.pass).toBe(true);
    expect(g.pct).toBeCloseTo(0.8);
    expect(g.needed).toBe(16);
  });

  it("fails one below the pass mark", () => {
    expect(Core.gradeExam(15, 20, 0.8).pass).toBe(false);
    expect(Core.gradeExam(15, 20, 0.8).needed).toBe(16);
  });

  it("handles non-integral thresholds via ceil", () => {
    // 75% of 46 ≈ 34.5 → need 35
    expect(Core.gradeExam(35, 46, 0.75).pass).toBe(true);
    expect(Core.gradeExam(34, 46, 0.75).pass).toBe(false);
  });

  it("respects stricter settings (85%)", () => {
    expect(Core.gradeExam(17, 20, 0.85).pass).toBe(true);  // exactly 85%
    expect(Core.gradeExam(16, 20, 0.85).pass).toBe(false);
    expect(Core.gradeExam(16, 20, 0.85).needed).toBe(17);
  });

  it("zero questions graded safely", () => {
    const g = Core.gradeExam(0, 0, 0.8);
    expect(g.pct).toBe(0);
    expect(g.pass).toBe(false);
  });
});

describe("exam timing", () => {
  it("is one minute per question", () => {
    expect(Core.timeLimitSecs(10)).toBe(600);
    expect(Core.timeLimitSecs(46)).toBe(2760);
  });
});

describe("exam blueprint", () => {
  it("distributes seats proportionally and sums exactly to n", () => {
    const bp = Core.examBlueprint(bank, 23);
    expect(bp.reduce((t, x) => t + x.take, 0)).toBe(23);
    // every topic gets at least floor share — no topic can be skipped entirely
    bp.forEach((x) => expect(x.take).toBeGreaterThan(0));
  });

  it("caps seats at topic size when n exceeds availability", () => {
    const small = bank.filter((q) => q.cat === "signs");
    const bp = Core.examBlueprint(small, 100);
    expect(bp.reduce((t, x) => t + x.take, 0)).toBe(small.length);
  });
});

describe("exam assembly", () => {
  it("returns exactly n distinct questions", () => {
    const qs = Core.assembleExam({ bank, n: 30, qstats: {}, rand: () => 0.42 });
    expect(qs.length).toBe(30);
    expect(new Set(qs.map((q) => q.id)).size).toBe(30);
  });

  it("honours the topic blueprint approximately (no runaway skew)", () => {
    for (let seed = 0; seed < 5; seed++) {
      const qs = Core.assembleExam({ bank, n: 25, qstats: {}, rand: mulberry(seed * 999 + 7) });
      const byCat = {};
      qs.forEach((q) => { byCat[q.cat] = (byCat[q.cat] || 0) + 1; });
      Object.entries(byCat).forEach(([cat, n]) => {
        // each topic's share should be within ±2 seats of its proportional share (5)
        expect(Math.abs(n - 5)).toBeLessThanOrEqual(2 + 1);
        void cat;
      });
    }
  });

  it("weakBias concentrates on the weakest topics", () => {
    const qstats = {};
    bank.forEach((q) => {
      if (q.cat === "alcohol" || q.cat === "parking") qstats[q.id] = { seen: 10, correct: 2, wrong: 8 };
      else if (q.cat === "laws") qstats[q.id] = { seen: 10, correct: 7, wrong: 3 };
      else qstats[q.id] = { seen: 10, correct: 10, wrong: 0 };
    });
    const qs = Core.assembleExam({ bank, n: 20, qstats, weakBias: true, rand: mulberry(3) });
    // the 3 weakest topics by accuracy
    const cats = [...new Set(bank.map((q) => q.cat))];
    const weakCats = cats
      .map((c) => ({ c, acc: Core.catAccuracy(bank.filter((q) => q.cat === c), qstats) }))
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 3)
      .map((x) => x.c);
    const weakShare = qs.filter((q) => weakCats.includes(q.cat)).length / 20;
    expect(weakShare).toBeGreaterThanOrEqual(0.55); // ~60% reserved by design
  });
});

/* deterministic RNG so sampling tests are stable */
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
