/* Hazard-perception analytics + scenario-bank tests.
 * Covers Core.hazardAnalysis outcomes, anticipation classes, excessive
 * clicking, Core.hazardSummary aggregates and verdict bands, deterministic
 * feedback strings, and the integrity of the scenario bank in
 * js/hazard-scenarios.js (bounds, unique names, clues, decoys). */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import HZS from "../js/hazard-scenarios.js";

const S = 3.0, E = 5.6;

/* ---------------- hazardAnalysis outcomes ---------------- */
describe("hazardAnalysis outcomes", () => {
  it("no presses → missed / none", () => {
    const a = Core.hazardAnalysis("Test hazard", [], S, E);
    expect(a.outcome).toBe("missed");
    expect(a.anticipation).toBe("none");
    expect(a.pts).toBe(0);
    expect(a.scoredPress).toBe(null);
    expect(a.pressCount).toBe(0);
  });

  it("press before the grace edge → early / over-eager", () => {
    const a = Core.hazardAnalysis("Test hazard", [S - 1], S, E);
    expect(a.outcome).toBe("early");
    expect(a.anticipation).toBe("over-eager");
    expect(a.pts).toBe(0);
    expect(a.band).toBe("early");
  });

  it("press in the developing window → window outcome", () => {
    const a = Core.hazardAnalysis("Test hazard", [S + 0.1], S, E);
    expect(a.outcome).toBe("window");
    expect(a.band).toBe("instant");
    expect(a.pts).toBe(5);
  });

  it("press well after the window still scores but is late recognition", () => {
    const a = Core.hazardAnalysis("Test hazard", [E + 2], S, E);
    expect(a.band).toBe("close");
    expect(a.pts).toBe(1);
    expect(a.anticipation).toBe("reactive");
  });

  it("the full press list is used: first press is the scored one, count is all", () => {
    const a = Core.hazardAnalysis("Test hazard", [S + 0.2, S + 0.9, S + 1.5], S, E);
    expect(a.pressCount).toBe(3);
    expect(a.scoredPress).toBe(S + 0.2);
    expect(a.pts).toBe(5);
  });

  it("presses are sorted before scoring: an unsorted list scores the earliest", () => {
    const a = Core.hazardAnalysis("Test hazard", [E + 1, S - 2, S + 0.3], S, E);
    expect(a.scoredPress).toBe(S - 2);
    expect(a.outcome).toBe("early");
    expect(a.pressCount).toBe(3);
  });

  it("invalid press entries are ignored", () => {
    const a = Core.hazardAnalysis("Test hazard", [null, -3, NaN, "x", S + 0.2], S, E);
    expect(a.pressCount).toBe(1);
    expect(a.scoredPress).toBe(S + 0.2);
  });
});

/* ---------------- anticipation classes ---------------- */
describe("anticipation classes", () => {
  it("instant and good bands are anticipatory", () => {
    expect(Core.hazardAnalysis("h", [S], S, E).anticipation).toBe("anticipatory");
    expect(Core.hazardAnalysis("h", [S + 1.0], S, E).anticipation).toBe("anticipatory");
  });

  it("close band (late in window) is reactive", () => {
    const a = Core.hazardAnalysis("h", [E], S, E);
    expect(a.band).toBe("close");
    expect(a.outcome).toBe("window");
    expect(a.anticipation).toBe("reactive");
  });

  it("a press after the window end is late recognition (reactive)", () => {
    const a = Core.hazardAnalysis("h", [E + 1.5], S, E);
    expect(a.scoredPress).toBeGreaterThan(a.winEnd);
    expect(a.anticipation).toBe("reactive");
  });

  it("missed is never anticipatory", () => {
    expect(Core.hazardAnalysis("h", [], S, E).anticipation).toBe("none");
  });
});

/* ---------------- excessive clicking ---------------- */
describe("excessive clicking", () => {
  it("exactly HAZARD_PRESS_CAP presses is not excessive", () => {
    const presses = Array.from({ length: Core.HAZARD_PRESS_CAP }, (_, i) => S - 1 + i * 0.3);
    expect(Core.hazardAnalysis("h", presses, S, E).excessive).toBe(false);
  });

  it("HAZARD_PRESS_CAP + 1 presses is excessive", () => {
    const presses = Array.from({ length: Core.HAZARD_PRESS_CAP + 1 }, (_, i) => S - 1 + i * 0.3);
    const a = Core.hazardAnalysis("h", presses, S, E);
    expect(a.excessive).toBe(true);
    expect(a.pressCount).toBe(Core.HAZARD_PRESS_CAP + 1);
  });

  it("excessive clicking does not change the scored press", () => {
    const presses = Array.from({ length: 12 }, (_, i) => S + 0.1 + i * 0.2);
    const a = Core.hazardAnalysis("h", presses, S, E);
    expect(a.scoredPress).toBe(S + 0.1);
    expect(a.excessive).toBe(true);
  });
});

/* ---------------- hazardSummary aggregates + verdict bands ---------------- */
describe("hazardSummary", () => {
  const mk = (pts, outcome, anticipation, excessive = false) => ({
    pts, outcome, anticipation, excessive,
    winStart: S, winEnd: E, scoredPress: outcome === "missed" ? null : S + 1,
  });

  it("empty input → no-data", () => {
    const s = Core.hazardSummary([]);
    expect(s.verdict).toBe("no-data");
    expect(s.total).toBe(0);
    expect(s.maxPts).toBe(0);
  });

  it("aggregates counts and rates", () => {
    const rows = [
      mk(5, "window", "anticipatory"),
      mk(1, "window", "reactive"),
      mk(0, "early", "over-eager", true),
      mk(0, "missed", "none"),
    ];
    const s = Core.hazardSummary(rows);
    expect(s.total).toBe(4);
    expect(s.pts).toBe(6);
    expect(s.maxPts).toBe(20);
    expect(s.windowHits).toBe(2);
    expect(s.early).toBe(1);
    expect(s.missed).toBe(1);
    expect(s.late).toBe(0);
    expect(s.excessive).toBe(1);
    expect(s.anticipatoryRate).toBeCloseTo(0.25);
    expect(s.lateRate).toBe(0);
  });

  it("verdict bands: >=0.75 sharp, >=0.55 developing, else needs-work", () => {
    const sharp = Core.hazardSummary([mk(5, "window", "anticipatory"), mk(4, "window", "anticipatory"), mk(4, "window", "anticipatory")]);
    expect(sharp.pts / (sharp.total * 5)).toBeGreaterThanOrEqual(0.75);
    expect(sharp.verdict).toBe("sharp");

    const developing = Core.hazardSummary([mk(3, "window", "reactive"), mk(3, "window", "anticipatory")]);
    expect(developing.verdict).toBe("developing");

    const needsWork = Core.hazardSummary([mk(1, "window", "reactive"), mk(0, "missed", "none")]);
    expect(needsWork.verdict).toBe("needs-work");
  });

  it("late outcome counts into lateRate", () => {
    const s = Core.hazardSummary([mk(1, "late", "reactive"), mk(5, "window", "anticipatory")]);
    expect(s.late).toBe(1);
    expect(s.lateRate).toBeCloseTo(0.5);
  });
});

/* ---------------- deterministic feedback ---------------- */
describe("hazardFeedback determinism", () => {
  it("same inputs always produce the same string", () => {
    const a = Core.hazardFeedback("Cyclist", "late", "reactive", 2, 3.2);
    const b = Core.hazardFeedback("Cyclist", "late", "reactive", 2, 3.2);
    expect(a).toBe(b);
  });

  it("every outcome has situation-specific copy, never DVSA-claiming", () => {
    const outs = ["missed", "early", "late", "window"];
    for (const o of outs) {
      const f = Core.hazardFeedback("Cyclist", o, "anticipatory", 1, 3.2);
      expect(typeof f).toBe("string");
      expect(f.length).toBeGreaterThan(20);
      expect(f).not.toMatch(/DVSA|official/i);
    }
  });

  it("hazardAnalysis feedback matches hazardFeedback for the same outcome", () => {
    const a = Core.hazardAnalysis("Cyclist", [E + 2], S, E);
    expect(a.feedback).toBe(Core.hazardFeedback("Cyclist", a.outcome, a.anticipation, a.pressCount, a.winStart));
  });
});

/* ---------------- scenario bank integrity ---------------- */
describe("js/hazard-scenarios.js bank", () => {
  const bank = HZS.scenarios;

  it("ships at least 22 scenarios", () => {
    expect(bank.length).toBeGreaterThanOrEqual(22);
  });

  it("covers the required training categories", () => {
    const cats = new Set(bank.map((s) => s.category));
    for (const required of [
      "pedestrians", "cyclists", "motorcyclists", "children", "parked-vehicles",
      "junctions", "roundabouts", "merging", "rain", "darkness", "country-roads",
      "animals", "roadworks", "buses", "delivery-vehicles", "concealed",
      "multiple-hazards",
    ]) {
      expect(cats.has(required), `missing category: ${required}`).toBe(true);
    }
  });

  it("every scenario has valid win/max bounds: 0 <= win[0] < win[1] <= max", () => {
    for (const sc of bank) {
      expect(Array.isArray(sc.win), sc.name).toBe(true);
      expect(sc.win.length, sc.name).toBe(2);
      const [a, b] = sc.win;
      expect(typeof a).toBe("number");
      expect(typeof b).toBe("number");
      expect(a, sc.name).toBeGreaterThanOrEqual(0);
      expect(b, sc.name).toBeGreaterThan(a);
      expect(b, sc.name).toBeLessThanOrEqual(sc.max);
      expect(sc.max, sc.name).toBeGreaterThan(0);
    }
  });

  it("every scenario awards max points at the window start and inside its own bounds", () => {
    for (const sc of bank) {
      expect(Core.hazardScore(sc.win[0], sc.win[0], sc.win[1]).pts, sc.name).toBe(5);
      expect(Core.hazardScore(sc.win[1], sc.win[0], sc.win[1]).pts, sc.name).toBeGreaterThanOrEqual(1);
    }
  });

  it("names are unique", () => {
    const names = bank.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every scenario has at least one clue, plus hazard, response and tip", () => {
    for (const sc of bank) {
      expect(Array.isArray(sc.clues), sc.name).toBe(true);
      expect(sc.clues.length, sc.name).toBeGreaterThanOrEqual(1);
      expect(typeof sc.hazard).toBe("string");
      expect(sc.hazard.length).toBeGreaterThan(10);
      expect(typeof sc.response).toBe("string");
      expect(typeof sc.tip).toBe("string");
      expect(typeof sc.objs).toBe("function");
    }
  });

  it("at least 3 multi-hazard scenarios declare decoys", () => {
    const multis = bank.filter((s) => s.multi);
    expect(multis.length).toBeGreaterThanOrEqual(3);
    for (const sc of multis) {
      expect(Array.isArray(sc.decoys), sc.name).toBe(true);
      expect(sc.decoys.length, sc.name).toBeGreaterThanOrEqual(1);
    }
  });

  it("single-hazard scenarios never declare decoys", () => {
    for (const sc of bank.filter((s) => !s.multi)) {
      expect(sc.decoys, sc.name).toBe(undefined);
    }
  });

  it("scene builder is deterministic and never throws across the scenario timeline", () => {
    for (const sc of bank) {
      const a = HZS.buildScene(1.5, sc);
      const b = HZS.buildScene(1.5, sc);
      expect(a, sc.name).toBe(b);
      expect(a, sc.name).toContain("<rect");
      for (let t = 0; t <= sc.max; t += 0.7) {
        expect(() => HZS.buildScene(t, sc), `${sc.name}@${t}`).not.toThrow();
      }
    }
  });
});

/* ---------------- timeline text + summary helpers ---------------- */
describe("timelineText", () => {
  const sc = { name: "h", win: [S, E], max: 8 };

  it("describes the window and every click deterministically", () => {
    const a = Core.hazardAnalysis("h", [1.5, S + 1], S, E);
    const txt = HZS.timelineText(sc, a, [1.5, S + 1]);
    expect(txt).toContain(`Developing window: ${S.toFixed(1)}s to ${E.toFixed(1)}s`);
    expect(txt).toContain("1.5s (before the hazard developed)");
    expect(txt).toContain("First useful click");
    expect(HZS.timelineText(sc, a, [1.5, S + 1])).toBe(txt);
  });

  it("says so when nothing was clicked", () => {
    const a = Core.hazardAnalysis("h", [], S, E);
    expect(HZS.timelineText(sc, a, [])).toContain("did not click");
  });
});

describe("summaryCounts and nextSteps", () => {
  it("counts anticipation classes and late recognition", () => {
    const rows = [
      { anticipation: "anticipatory", scoredPress: S, winEnd: E, excessive: false },
      { anticipation: "reactive", scoredPress: E + 1, winEnd: E, excessive: true },
      { anticipation: "over-eager", scoredPress: S - 1, winEnd: E, excessive: false },
      { anticipation: "none", scoredPress: null, winEnd: E, excessive: false },
    ];
    const c = HZS.summaryCounts(rows);
    expect(c.anticipatory).toBe(1);
    expect(c.reactive).toBe(1);
    expect(c.overEager).toBe(1);
    expect(c.none).toBe(1);
    expect(c.lateRecognition).toBe(1);
    expect(c.excessive).toBe(1);
  });

  it("returns 1-2 specific next-step lines, deterministically", () => {
    const summary = Core.hazardSummary([
      { pts: 0, outcome: "missed", anticipation: "none", excessive: false },
      { pts: 0, outcome: "early", anticipation: "over-eager", excessive: true },
    ]);
    const steps = HZS.nextSteps(summary, HZS.summaryCounts([
      { anticipation: "over-eager", scoredPress: 1, winEnd: E, excessive: true },
      { anticipation: "none", scoredPress: null, winEnd: E, excessive: false },
    ]));
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps.length).toBeLessThanOrEqual(2);
    for (const s of steps) {
      expect(s.length).toBeGreaterThan(20);
      expect(s).not.toMatch(/DVSA|official/i);
    }
    expect(HZS.nextSteps(summary, HZS.summaryCounts([]))).not.toBe(undefined);
  });
});
