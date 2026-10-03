/* Hazard phases & timing analysis: anticipation vs false positives,
   scenario-data integrity, category skill roll-up. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import HazardScenarios from "../js/hazard-scenarios.js";

const SCENARIOS = HazardScenarios.scenarios;
const CATEGORIES = HazardScenarios.CATEGORY_LABELS;

describe("hazardPhaseAt boundaries", () => {
  it("classifies background / potential / developing / critical in order", () => {
    expect(Core.hazardPhaseAt(0.4, 3, 5, 1.5)).toBe("background");
    expect(Core.hazardPhaseAt(1.5, 3, 5, 1.5)).toBe("potential");
    expect(Core.hazardPhaseAt(2.99, 3, 5, 1.5)).toBe("potential");
    expect(Core.hazardPhaseAt(3, 3, 5, 1.5)).toBe("developing");
    expect(Core.hazardPhaseAt(4.9, 3, 5, 1.5)).toBe("developing");
    expect(Core.hazardPhaseAt(5, 3, 5, 1.5)).toBe("critical");
    expect(Core.hazardPhaseAt(null, 3, 5, 1.5)).toBe(null);
    expect(Core.hazardPhaseAt(-1, 3, 5, 1.5)).toBe(null);
  });

  it("defaults the potential window to 1.5s before the developing window", () => {
    expect(Core.hazardPhaseAt(1.6, 3, 5, null)).toBe("potential");
    expect(Core.hazardPhaseAt(1.4, 3, 5, null)).toBe("background");
  });
});

describe("hazardTiming: anticipation vs false positives", () => {
  const WIN = [3, 5];

  it("a click in the potential phase is correct anticipation, not a false positive", () => {
    const analysis = Core.hazardAnalysis("Cyclist", [2.0], WIN[0], WIN[1]);
    const t = Core.hazardTiming(analysis, [2.0], WIN[0], WIN[1], 1.5);
    expect(t.anticipatory).toBe(true);
    expect(t.falsePositives).toBe(0);
    expect(t.firstObservationPhase).toBe("potential");
  });

  it("a click in the background is a false positive", () => {
    const analysis = Core.hazardAnalysis("Cyclist", [0.5], WIN[0], WIN[1]);
    const t = Core.hazardTiming(analysis, [0.5], WIN[0], WIN[1], 1.5);
    expect(t.falsePositives).toBe(1);
    expect(t.anticipatory).toBe(false);
    expect(t.firstObservationPhase).toBe("background");
  });

  it("counts repeated clicks and the first observation phase", () => {
    const analysis = Core.hazardAnalysis("Door", [0.5, 2.0, 2.2, 4.0], WIN[0], WIN[1]);
    const t = Core.hazardTiming(analysis, [0.5, 2.0, 2.2, 4.0], WIN[0], WIN[1], 1.5);
    expect(t.repeatedClicks).toBe(4);
    expect(t.firstObservation).toBe(0.5);
    expect(t.firstObservationPhase).toBe("background");
    expect(t.anticipatory).toBe(true); // later click landed in potential
    expect(t.falsePositives).toBe(1);
  });

  it("marks window hits, late and missed outcomes", () => {
    const hit = Core.hazardAnalysis("Door", [3.5], WIN[0], WIN[1]);
    expect(Core.hazardTiming(hit, [3.5], WIN[0], WIN[1], 1.5).windowHit).toBe(true);
    const late = Core.hazardAnalysis("Door", [5.5], WIN[0], WIN[1]);
    const tLate = Core.hazardTiming(late, [5.5], WIN[0], WIN[1], 1.5);
    expect(tLate.late).toBe(true);
    const miss = Core.hazardAnalysis("Door", [], WIN[0], WIN[1]);
    const tMiss = Core.hazardTiming(miss, [], WIN[0], WIN[1], 1.5);
    expect(tMiss.missed).toBe(true);
    expect(tMiss.firstObservation).toBe(null);
  });

  it("empty presses produce a clean no-observation timing", () => {
    const t = Core.hazardTiming(Core.hazardAnalysis("X", [], 3, 5), [], 3, 5, 1.5);
    expect(t.repeatedClicks).toBe(0);
    expect(t.falsePositives).toBe(0);
    expect(t.missed).toBe(true);
  });
});

describe("hazardCategorySkill roll-up", () => {
  it("aggregates by category and sorts weakest first", () => {
    const rows = Core.hazardCategorySkill([
      { scenario: "a", pts: 5, outcome: "window", anticipation: "anticipatory" },
      { scenario: "a2", pts: 5, outcome: "window", anticipation: "anticipatory" },
      { scenario: "b", pts: 1, outcome: "late", anticipation: "reactive" },
      { scenario: "b2", pts: 1, outcome: "missed", anticipation: "none" },
    ], (name) => (name.startsWith("a") ? "pedestrians" : "concealed"));
    expect(rows[0].category).toBe("concealed");
    expect(rows[0].rate).toBeLessThan(rows[1].rate);
    expect(rows[0].late + rows[0].missed).toBe(2);
  });

  it("empty analyses yield no rows", () => {
    expect(Core.hazardCategorySkill([], () => "x")).toEqual([]);
    expect(Core.hazardCategorySkill(null, () => "x")).toEqual([]);
  });
});

describe("scenario bank integrity (the extended 35-scenario bank)", () => {
  it("has at least 31 scenarios with unique names and explicit categories", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(31);
    const names = new Set(SCENARIOS.map((s) => s.name));
    expect(names.size).toBe(SCENARIOS.length);
    for (const s of SCENARIOS) {
      expect(s.category, s.name).toBeTruthy();
      expect(Object.keys(CATEGORIES), s.name).toContain(s.category);
    }
  });

  it("every scenario declares a potential window ending exactly at the window start", () => {
    for (const s of SCENARIOS) {
      expect(s.phases && s.phases.potential, s.name).toBeTruthy();
      const [p0, p1] = s.phases.potential;
      expect(p1, s.name).toBeCloseTo(s.win[0], 5);
      expect(p0, s.name).toBeLessThan(s.win[0]);
      expect(0, s.name).toBeLessThanOrEqual(p0);
      expect(s.win[0], s.name).toBeLessThan(s.win[1]);
      expect(s.win[1], s.name).toBeLessThanOrEqual(s.max);
    }
  });

  it("at least 4 scenarios have long potential windows (the must-wait skill)", () => {
    const long = SCENARIOS.filter((s) => s.win[0] - s.phases.potential[0] >= 2.0);
    expect(long.length).toBeGreaterThanOrEqual(4);
  });

  it("multi-hazard scenes declare their decoys", () => {
    const multis = SCENARIOS.filter((s) => s.multi);
    expect(multis.length).toBeGreaterThanOrEqual(3);
    for (const s of multis) {
      expect(Array.isArray(s.decoys) && s.decoys.length > 0, s.name).toBe(true);
    }
  });

  it("every scenario has at least one clue and a developing-hazard description", () => {
    for (const s of SCENARIOS) {
      expect(s.clues && s.clues.length >= 1, s.name).toBe(true);
      expect(s.hazard && s.hazard.length > 10, s.name).toBe(true);
    }
  });

  it("a true no-development distractor scene and a must-wait scene both exist", () => {
    const distractors = SCENARIOS.filter((s) => s.distractorScene);
    expect(distractors.length).toBeGreaterThanOrEqual(1);
    const mustWait = SCENARIOS.filter((s) => s.win[0] - s.phases.potential[0] >= 2.0 && s.win[1] - s.win[0] >= 2.0);
    expect(mustWait.length).toBeGreaterThanOrEqual(1);
  });

  it("display helpers produce phase-framed copy without DVSA claims", () => {
    const sc = SCENARIOS[0];
    const analysis = Core.hazardAnalysis(sc.name, [2.0], sc.win[0], sc.win[1]);
    const timing = Core.hazardTiming(analysis, [2.0], sc.win[0], sc.win[1], sc.phases.potential[0]);
    const narrative = HazardScenarios.phaseNarrative(sc, timing);
    // phaseNarrative returns an array of phase-framed lines (the UI joins them)
    expect(Array.isArray(narrative)).toBe(true);
    expect(narrative.join(" ").length).toBeGreaterThan(20);
    const arc = HazardScenarios.phaseArcText(sc);
    expect(arc).toMatch(/Potential/i);
    expect(arc).toMatch(/Critical/i);
    // honest copy: never official-result or DVSA scoring claims
    const all = SCENARIOS.map((s) => `${s.name} ${s.hazard} ${s.response} ${s.tip}`).join(" ");
    expect(all).not.toMatch(/DVSA (scoring|clip)|official (result|score)/i);
  });

  it("skill lines and coaching stay honest and specific", () => {
    const row = { category: "concealed", attempts: 4, late: 3, missed: 0 };
    expect(HazardScenarios.skillLine(row)).toMatch(/detected late in 3 of 4/);
    const coaching = HazardScenarios.categoryCoaching([row], SCENARIOS);
    expect(coaching.lines.join(" ")).toMatch(/concealed/i);
    expect(coaching.recommendation).toMatch(/· ~\d+ min/);
    // the zero-attempt guard must never read "in 0 of 0"
    expect(HazardScenarios.skillLine({ category: "rain", attempts: 1, late: 0, missed: 1 })).not.toMatch(/0 of 0/);
  });
});
