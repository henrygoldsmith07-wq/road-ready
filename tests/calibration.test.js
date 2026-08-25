/* REGRESSION: calibration must be honest — no pass-probability claims until a
   bucket has enough pooled outcomes, and never a practical-driving claim. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-08-23T12:00:00Z");

const samples = (pairs) => pairs.map(([pct, result]) => ({ readinessPct: pct, result }));

describe("calibrationCurve", () => {
  it("buckets outcomes and gates rates on MIN_BUCKET_N", () => {
    const res = Core.calibrationCurve(samples([[82, "pass"], [84, "pass"], [86, "fail"]]));
    const b = res.buckets.find((x) => x.bucket === "80–89%");
    expect(b.n).toBe(3);
    expect(b.sufficient).toBe(false);
    expect(b.passRate).toBe(null); // 3 < 8 → insufficient, even though ~67% observed
  });

  it("releases a rate once the bucket reaches the threshold", () => {
    const pairs = Array.from({ length: 12 }, (_, i) => [85, i < 9 ? "pass" : "fail"]); // 9/12: Wilson width ≤0.45
    const res = Core.calibrationCurve(samples(pairs));
    const b = res.buckets.find((x) => x.bucket === "80–89%");
    expect(b.sufficient).toBe(true);
    expect(b.passRate).toBeCloseTo(0.75);
  });
});

describe("readinessNarrative honesty branches", () => {
  it("insufficient data → plain estimate wording, no probability claim", () => {
    const n = Core.readinessNarrative({
      readinessPct: 84,
      curve: Core.calibrationCurve(samples([[82, "pass"]])),
      riskTopics: ["junction priority"],
    });
    expect(n.mode).toBe("insufficient");
    expect(n.text).toContain("84%");
    expect(n.text).not.toMatch(/passed about \d+%/);
    expect(n.disclaimer).toContain("practical driving");
  });

  it("sufficient bucket → calibrated sentence with rate + focus areas + disclaimer", () => {
    const pairs = Array.from({ length: 10 }, (_, i) => [84, i < 9 ? "pass" : "fail"]);
    const n = Core.readinessNarrative({
      readinessPct: 84,
      curve: Core.calibrationCurve(samples(pairs)),
      riskTopics: ["Junction Priority"],
    });
    expect(n.mode).toBe("calibrated");
    expect(n.text).toMatch(/80–89%/);
    expect(n.text).not.toMatch(/chance of passing/i);
    expect(n.text).toContain("Focus areas right now: junction priority");
    expect(n.calibratedPassRate).toBeCloseTo(0.9);
    expect(n.disclaimer).toContain("practical driving");
  });

  it("adds a provisional clause when recent mocks are unstable", () => {
    const pairs = Array.from({ length: 10 }, (_, i) => [84, i < 9 ? "pass" : "fail"]);
    const n = Core.readinessNarrative({
      readinessPct: 84,
      curve: Core.calibrationCurve(samples(pairs)),
      stabilitySpread: 22, // points scale
    });
    expect(n.text).toContain("unstable (varying by 22 points)");
    expect(n.text).toContain("provisional");
  });

  it("never claims readiness for independent practical driving", () => {
    const pairs = Array.from({ length: 10 }, () => [92, "pass"]);
    const n = Core.readinessNarrative({
      readinessPct: 95,
      curve: Core.calibrationCurve(samples(pairs)),
    });
    expect(n.text.toLowerCase()).not.toContain("practical");
    expect(n.disclaimer.toLowerCase()).toContain("practical driving");
  });
});

describe("feature snapshot for outcome samples", () => {
  it("mockStability returns spread of recent exams (null under 2)", () => {
    expect(Core.mockStability([{ pct: 0.7 }])).toBe(null);
    expect(Core.mockStability([{ pct: 0.6 }, { pct: 0.9 }, { pct: 0.7 }], 3)).toBeCloseTo(0.3);
  });

  it("appendOutcome keeps calibration features and clamps them", () => {
    const log = Core.appendOutcome([], {
      progressPct: 84, mockAvgPct: 88, coveragePct: 97, stabilitySpread: 4,
      diagnosticPct: 64, jurisdiction: "CA", questionsSeen: 420, studyMinutes: 228,
      result: "pass",
    }, NOW);
    expect(log[0]).toMatchObject({ coveragePct: 97, stabilitySpread: 4, diagnosticPct: 64, jurisdiction: "CA" });
  });
});
