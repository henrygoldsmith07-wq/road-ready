// Repeated-mock diversity: exam assembly should prefer questions the learner
// has NOT seen recently, without distorting the published topic weighting or
// breaking the fixed-form determinism used by study diagnostics.
import { describe, expect, it } from "vitest";
import Core from "../js/core.js";

const now = 1_800_000_000_000;
const HOUR = 3600 * 1000;

function bank(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    cat: i % 2 === 0 ? "signs" : "row",
    q: `Q${i}`,
    choices: ["a", "b", "c", "d"],
    a: 0,
    why: "why",
  }));
}

// Deterministic RNG so the test never flakes.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("exam anti-repetition", () => {
  it("avoids recently seen questions when fresh alternatives exist", () => {
    const questions = bank(40);
    // Mark the first 10 questions as seen 1 hour ago (well inside the window).
    const recentlySeen = {};
    questions.slice(0, 10).forEach((q) => { recentlySeen[q.id] = { lastSeen: now - HOUR }; });

    const withRecency = Core.assembleExam({
      bank: questions, n: 20, rand: mulberry32(42), recentlySeen, nowMs: now,
    });
    const reused = withRecency.filter((q) => recentlySeen[q.id]).length;
    expect(reused).toBe(0);

    // Without recency information the same assembly may reuse them — the point
    // is that the information changes the selection.
    const without = Core.assembleExam({
      bank: questions, n: 20, rand: mulberry32(42), nowMs: now,
    });
    expect(without.some((q) => recentlySeen[q.id])).toBe(true);
  });

  it("falls back to recent questions when a stratum cannot supply fresh items", () => {
    const questions = bank(40);
    const recentlySeen = {};
    questions.forEach((q) => { recentlySeen[q.id] = { lastSeen: now - HOUR }; });
    const qs = Core.assembleExam({
      bank: questions, n: 20, rand: mulberry32(7), recentlySeen, nowMs: now,
    });
    // Every item is recent, so the exam must still be fully assembled.
    expect(qs).toHaveLength(20);
  });

  it("keeps the topic weighting intact while reordering which items appear", () => {
    const questions = bank(40); // 20 signs, 20 row
    const recentlySeen = {};
    questions.filter((q) => q.cat === "signs").slice(0, 10).forEach((q) => {
      recentlySeen[q.id] = { lastSeen: now - HOUR };
    });
    const qs = Core.assembleExam({
      bank: questions, n: 20, rand: mulberry32(99), recentlySeen, nowMs: now,
    });
    const signs = qs.filter((q) => q.cat === "signs").length;
    // Uniform bank: roughly balanced between the two strata (allow jitter).
    expect(Math.abs(signs - 10)).toBeLessThanOrEqual(3);
  });

  it("never applies recency to fixed (seeded) forms", () => {
    const questions = bank(40);
    const recentlySeen = {};
    questions.slice(0, 10).forEach((q) => { recentlySeen[q.id] = { lastSeen: now - HOUR }; });
    const a = Core.assembleExam({
      bank: questions, n: 15, samplingMode: "fixed", seed: 0xD1A6, recentlySeen, nowMs: now,
    });
    const b = Core.assembleExam({
      bank: questions, n: 15, samplingMode: "fixed", seed: 0xD1A6, nowMs: now,
    });
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });
});
