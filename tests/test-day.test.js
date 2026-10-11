/* Test-day simulation: the combined theory + hazard verdict is pure core logic —
   both bars must clear, like the real test. The hazard bar is the official
   44/75 scaled to our 14 original five-point scenarios. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

describe("scaledHazardPass", () => {
  it("scales the official 44/75 bar to 14 five-point scenarios", () => {
    expect(Core.SIM_HAZARD_CLIPS).toBe(14);
    expect(Core.scaledHazardPass(14)).toBe(41);
  });
  it("clamps nonsense input instead of producing a nonsense bar", () => {
    expect(Core.scaledHazardPass(0)).toBeGreaterThan(0);
    expect(Core.scaledHazardPass(-5)).toBeGreaterThan(0);
    expect(Core.scaledHazardPass(12)).toBe(Math.round((44 / 75) * 12 * 5));
  });
});

describe("combinedVerdict", () => {
  const theory = { correct: 44, total: 50, minCorrect: 43 };
  const hazard = { pts: 52, max: 70, passPts: 41 };
  it("passes only when both sections clear their bars", () => {
    expect(Core.combinedVerdict(theory, hazard).pass).toBe(true);
  });
  it("a cleared theory section cannot carry a failed hazard section", () => {
    const v = Core.combinedVerdict(theory, { pts: 30, max: 70, passPts: 41 });
    expect(v).toMatchObject({ pass: false, theoryPass: true, hazardPass: false });
  });
  it("a strong hazard run cannot carry a failed theory section", () => {
    const v = Core.combinedVerdict({ correct: 40, total: 50, minCorrect: 43 }, hazard);
    expect(v).toMatchObject({ pass: false, theoryPass: false, hazardPass: true });
  });
  it("reports both percentages for the results screen", () => {
    const v = Core.combinedVerdict(theory, hazard);
    expect(v.theoryPct).toBeCloseTo(0.88);
    expect(v.hazardPct).toBeCloseTo(52 / 70);
  });
  it("never passes on empty input", () => {
    expect(Core.combinedVerdict(null, null).pass).toBe(false);
    expect(Core.combinedVerdict({}, {}).pass).toBe(false);
  });
});
