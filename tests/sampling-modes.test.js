/* REGRESSION: assessment validity — sampling modes must be separated.
   Official simulations and study diagnostics must NEVER inspect learner
   history (qstats/flags/due dates); only practice exams adapt. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const bank = [];
["signs", "row"].forEach((cat) => { for (let i = 0; i < 30; i++) bank.push({ id: `${cat}-${i}`, cat }); });

// learner A has struggled across half the bank and flagged it
const qa = {};
bank.forEach((q) => (qa[q.id] = { seen: 5, correct: 1, wrong: 4 }));
const flagsA = {};
bank.slice(0, 15).forEach((q) => (flagsA[q.id] = true));

function mul(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ids = (qs) => JSON.stringify(qs.map((q) => q.id));

describe("sampling modes", () => {
  it("representative: identical forms for a struggling and a fresh learner", () => {
    const r = mul(7);
    const a = Core.assembleExam({ bank, n: 10, qstats: qa, flags: flagsA, samplingMode: "representative", rand: mul(7) });
    const b = Core.assembleExam({ bank, n: 10, samplingMode: "representative", rand: mul(7) });
    void r;
    expect(ids(a)).toBe(ids(b));
  });

  it("representative still honours topic stratification", () => {
    const qs = Core.assembleExam({ bank, n: 10, samplingMode: "representative", rand: mul(3) });
    const byCat = {};
    qs.forEach((q) => (byCat[q.cat] = (byCat[q.cat] || 0) + 1));
    // 2 topics × 30 → ~5/5 split, never 10/0
    expect(Math.abs((byCat.signs || 0) - (byCat.row || 0))).toBeLessThanOrEqual(2);
  });

  it("fixed: locked form — same seed gives identical items regardless of history", () => {
    const a = Core.assembleExam({ bank, n: 15, qstats: qa, flags: flagsA, samplingMode: "fixed", seed: 42 });
    const b = Core.assembleExam({ bank, n: 15, samplingMode: "fixed", seed: 42 });
    expect(ids(a)).toBe(ids(b));
  });

  it("fixed: different seeds give different forms", () => {
    const a = Core.assembleExam({ bank, n: 15, samplingMode: "fixed", seed: 1 });
    const b = Core.assembleExam({ bank, n: 15, samplingMode: "fixed", seed: 2 });
    expect(ids(a)).not.toBe(ids(b));
  });

  it("adaptive: remains history-sensitive (struggling learner gets a different paper)", () => {
    const a = Core.assembleExam({ bank, n: 10, qstats: qa, flags: flagsA, samplingMode: "adaptive", rand: mul(7) });
    const b = Core.assembleExam({ bank, n: 10, samplingMode: "adaptive", rand: mul(7) });
    expect(ids(a)).not.toBe(ids(b));
  });

  it("adaptive stays the DEFAULT when samplingMode is omitted", () => {
    const omitted = Core.assembleExam({ bank, n: 10, qstats: qa, flags: flagsA, rand: mul(11) });
    const explicit = Core.assembleExam({ bank, n: 10, qstats: qa, flags: flagsA, samplingMode: "adaptive", rand: mul(11) });
    expect(ids(omitted)).toBe(ids(explicit));
  });
});
