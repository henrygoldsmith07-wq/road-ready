/* Concept-based mastery hierarchy: concept → topic → overall score.
   Memorising a single question must NOT saturate a concept. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

// an 8-question concept ("roundabout-priority") plus decoys
const bank = [];
for (let i = 0; i < 8; i++) {
  bank.push({ id: `rb${i}`, cat: "row", concept: "roundabout-priority", q: `R ${i}?`, choices: ["x", "y"], a: 0, why: "w" });
}
for (let i = 0; i < 4; i++) {
  bank.push({ id: `ot${i}`, cat: "signs", q: `S ${i}?`, choices: ["x", "y"], a: 0, why: "w" }); // coarse concept: topic:signs
}

const mastered = { seen: 6, correct: 6, wrong: 0 };

describe("concept mastery", () => {
  it("one memorised question out of eight stays low (~0.13), never 100%", () => {
    const stats = { rb0: mastered };
    const m = Core.conceptMastery(bank.filter((q) => q.concept === "roundabout-priority"), stats);
    expect(m).toBeGreaterThan(0.1);
    expect(m).toBeLessThan(0.2);
  });

  it("saturates only when every question of the concept is mastered", () => {
    const stats = {};
    for (const q of bank.filter((x) => x.concept === "roundabout-priority")) stats[q.id] = mastered;
    expect(Core.conceptMastery(bank.filter((x) => x.concept === "roundabout-priority"), stats)).toBe(1);
  });

  it("breadth with zero depth scores zero", () => {
    // attempted all 8 but wrong every time
    const stats = {};
    for (const q of bank) if (q.concept) stats[q.id] = { seen: 5, correct: 0, wrong: 5 };
    expect(Core.conceptMastery(bank.filter((x) => x.concept), stats)).toBe(0);
  });

  it("questions without an explicit concept inherit their topic", () => {
    expect(Core.conceptKeyOf({ cat: "signs" })).toBe("topic:signs");
    expect(Core.conceptKeyOf({ cat: "row", concept: "roundabout-priority" })).toBe("roundabout-priority");
  });
});

describe("hierarchy aggregation", () => {
  it("topic mastery averages its concepts weighted by size", () => {
    const rowQs = bank.filter((q) => q.cat === "row");
    const stats = { rb0: mastered };
    // 1/8 coverage × full depth = 0.125
    expect(Core.topicMastery(rowQs, stats)).toBeCloseTo(0.125);
  });

  it("readiness is damped by partial concept coverage vs old per-question math", () => {
    // master exactly one question of the 12-question bank
    const stats = { rb0: mastered };
    const r = Core.readiness(bank, stats, []);
    // concept coverage 1/8 damps masteryC to ~0.083; breadth adds 1/12:
    // expect ≈ 0.65×0.083 + 0.35×0.083 ≈ 0.083 — far below the memorised
    // question's own per-question mastery (~1.0)
    expect(r).toBeGreaterThan(0.05);
    expect(r).toBeLessThan(0.12);
    expect(r).toBeLessThan(Core.qMastery(stats.rb0));
  });

  it("readiness still saturates at 1 only with full breadth AND depth", () => {
    const stats = {};
    for (const q of bank) stats[q.id] = mastered;
    expect(Core.readiness(bank, stats, [])).toBeCloseTo(0.65 + 0.35); // mastery 1 + breadth 1
  });

  it("readiness stays 0 fresh, increases with progress, caps at 1", () => {
    expect(Core.readiness(bank, {}, [])).toBe(0);
    const half = {};
    for (const q of bank.slice(0, 6)) half[q.id] = mastered;
    const rHalf = Core.readiness(bank, half, []);
    const full = {};
    for (const q of bank) full[q.id] = mastered;
    const rFull = Core.readiness(bank, full, [{ pct: 1 }, { pct: 1 }]);
    expect(rHalf).toBeGreaterThan(0);
    expect(rFull).toBeLessThanOrEqual(1);
    expect(rFull).toBeGreaterThan(rHalf);
  });

  it("fine-grained concepts inside jurisdiction packs group independently", () => {
    const packsBank = [
      { id: "z1", cat: "alcohol", concept: "zero-tolerance" },
      { id: "z2", cat: "alcohol", concept: "zero-tolerance" },
      { id: "b1", cat: "alcohol", concept: "bac-limits" },
      { id: "b2", cat: "alcohol", concept: "bac-limits" },
    ];
    // memorise both bac questions but neither zero-tolerance question:
    // topic mastery must sit near 50%, not 100%
    const stats = { b1: mastered, b2: mastered };
    expect(Core.topicMastery(packsBank, stats)).toBeCloseTo(0.5);
  });
});
