/* REGRESSION: mastery must aggregate by CONCEPT (coverage x depth), so
   memorising one question can never saturate a concept. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const bank = [];
for (let i = 0; i < 8; i++) {
  bank.push({ id: `rb${i}`, cat: "row", concept: "roundabout-priority", q: `R${i}?`, choices: ["x", "y"], a: 0, why: "w" });
}
for (let i = 0; i < 4; i++) {
  bank.push({ id: `sgx${i}`, cat: "signs", q: `S${i}?`, choices: ["x", "y"], a: 0, why: "w" }); // inherits topic:signs
}

const mastered = { seen: 6, correct: 6, wrong: 0 };

describe("concept-mastery", () => {
  it("one memorised question of eight stays near 0.125", () => {
    const m = Core.conceptMastery(bank.filter((q) => q.concept), { rb0: mastered });
    expect(m).toBeGreaterThan(0.1);
    expect(m).toBeLessThan(0.2);
  });

  it("full breadth AND depth required for 1.0", () => {
    const all = {};
    for (const q of bank.filter((x) => x.concept)) all[q.id] = mastered;
    expect(Core.conceptMastery(bank.filter((x) => x.concept), all)).toBe(1);
    const partial = { ...all };
    delete partial.rb7;
    expect(Core.conceptMastery(bank.filter((x) => x.concept), partial)).toBeCloseTo((7 / 8) * Core.qMastery(mastered));
  });

  it("explicit concepts override the topic inheritance", () => {
    expect(Core.conceptKeyOf({ cat: "row" })).toBe("topic:row");
    expect(Core.conceptKeyOf(bank[0])).toBe("roundabout-priority");
  });

  it("topic mastery aggregates concepts by size (jurisdiction fine-concepts)", () => {
    const alcohol = [
      { id: "z1", cat: "alcohol", concept: "zero-tolerance" },
      { id: "z2", cat: "alcohol", concept: "zero-tolerance" },
      { id: "b1", cat: "alcohol", concept: "bac-limits" },
      { id: "b2", cat: "alcohol", concept: "bac-limits" },
    ];
    // memorise both bac-limits items; never touch zero-tolerance → 50%
    expect(Core.topicMastery(alcohol, { b1: mastered, b2: mastered })).toBeCloseTo(0.5);
  });

  it("overall score is damped vs per-question math and still monotonic/capped", () => {
    const r0 = Core.readiness(bank, {}, []);
    const one = Core.readiness(bank, { rb0: mastered }, []);
    const all = {};
    for (const q of bank) all[q.id] = mastered;
    const rFull = Core.readiness(bank, all, [{ pct: 1 }]);
    expect(r0).toBe(0);
    expect(one).toBeLessThan(0.12);                       // damping
    expect(one).toBeLessThan(Core.qMastery(mastered));    // below memorisation illusion
    expect(rFull).toBeGreaterThan(one);
    expect(rFull).toBeLessThanOrEqual(1);
  });
});
