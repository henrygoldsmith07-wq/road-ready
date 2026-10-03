/* Learning-evidence module: honest local measurement of whether RoadReady
   improves learners — insufficient evidence is the default claim. */
import { describe, it, expect } from "vitest";
import Evidence from "../js/evidence.js";

const NOW = Date.parse("2026-10-02T09:00:00Z");

const ev = (over) => Evidence.recordRecommendation([], {
  type: "build-coverage", followed: true,
  before: { conceptMastery: 0.4 }, during: { accuracy: 0.7 }, after: { conceptMastery: 0.45 },
  ...over,
}, NOW);

describe("recording", () => {
  it("appends a small structured event", () => {
    const list = ev();
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe("build-coverage");
    expect(list[0].followed).toBe(true);
    expect(list[0].before.conceptMastery).toBeCloseTo(0.4);
  });

  it("caps the log so long-term use cannot bloat the save", () => {
    let list = [];
    for (let i = 0; i < 250; i++) list = Evidence.recordRecommendation(list, { type: "x", followed: true }, NOW + i);
    expect(list.length).toBeLessThanOrEqual(200);
  });
});

describe("evaluation honesty", () => {
  it("reports insufficient evidence below the sample threshold", () => {
    const rep = Evidence.evaluate(ev());
    expect(rep.improvement.insufficient).toBe(true);
    expect(rep.improvement.need).toBe(8);
    expect(rep.statements.join(" ")).toMatch(/Not enough/i);
  });

  it("unlocks the improvement measure at the threshold and stays scoped to n", () => {
    let list = [];
    for (let i = 0; i < 8; i++) list = Evidence.recordRecommendation(list, {
      type: "build-coverage", followed: true,
      before: { conceptMastery: 0.4 }, after: { conceptMastery: 0.5 },
    }, NOW + i);
    const rep = Evidence.evaluate(list);
    expect(rep.improvement.n).toBe(8);
    expect(rep.improvement.meanMasteryDelta).toBeCloseTo(0.1);
  });

  it("misconception resolution rate needs its own sample", () => {
    let list = [];
    for (let i = 0; i < 5; i++) list = Evidence.recordRecommendation(list, {
      type: "fix-misconception", followed: true,
      before: { misconceptions: 3 }, after: { misconceptions: i % 2 ? 2 : 3 },
    }, NOW + i);
    const rep = Evidence.evaluate(list);
    expect(rep.misconceptionResolution.rate).toBeCloseTo(0.4);
    expect(rep.misconceptionResolution.n).toBe(5);
  });

  it("compares coach-selected and self-directed practice only with enough data", () => {
    let list = [];
    for (let i = 0; i < 4; i++) list = Evidence.recordRecommendation(list, {
      followed: i % 2 === 0,
      before: { accuracy: 0.5 }, during: { accuracy: 0.6 },
    }, NOW + i);
    const rep = Evidence.evaluate(list);
    expect(rep.coachSelectedLift.insufficient).toBe(true);
    expect(rep.selfDirectedLift.insufficient).toBe(true);
  });

  it("never claims a strategy is superior without paired data", () => {
    const rep = Evidence.evaluate([]);
    expect(rep.statements.join(" ")).not.toMatch(/superior|better than|proven/i);
  });

  it("retention probes report per-day samples", () => {
    const rep = Evidence.evaluate([], {
      nowMs: NOW,
      retentionLog: [
        { askedAt: NOW - 3 * 86400000, right: true },
        { askedAt: NOW - 3 * 86400000, right: true },
        { askedAt: NOW - 3 * 86400000, right: false },
      ],
    });
    expect(rep.retention[3].rate).toBeCloseTo(0.667, 2);
    expect(rep.retention[1].insufficient).toBe(true);
  });
});
