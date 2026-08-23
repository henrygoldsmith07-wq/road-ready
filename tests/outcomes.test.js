/* Outcome journal — the groundwork for calibrating P(pass | progress) */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-08-23T12:00:00Z");

describe("appendOutcome", () => {
  it("appends a clamped, well-formed entry", () => {
    const out = Core.appendOutcome([], { progressPct: 84, mockAvgPct: 88, questionsSeen: 420, studyMinutes: 228, result: "pass" }, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ progressPct: 84, mockAvgPct: 88, questionsSeen: 420, studyMinutes: 228, result: "pass" });
  });

  it("never mutates the input list (pure)", () => {
    const before = [];
    Core.appendOutcome(before, { result: "pass" }, NOW);
    expect(before).toHaveLength(0);
  });

  it("clamps garbage and rejects unknown results as 'unknown'", () => {
    const out = Core.appendOutcome([], { progressPct: 999, questionsSeen: -5, result: "MAYBE" }, NOW);
    expect(out[0].progressPct).toBe(100);
    expect(out[0].questionsSeen).toBe(0);
    expect(out[0].result).toBe("unknown");
  });

  it("supports multiple outcomes over time", () => {
    let list = Core.appendOutcome([], { progressPct: 62, result: "fail" }, NOW);
    list = Core.appendOutcome(list, { progressPct: 84, result: "pass" }, NOW + Core.DAY_MS);
    expect(list.map((o) => o.result)).toEqual(["fail", "pass"]);
  });
});

describe("mockAverage", () => {
  it("averages the most recent n exams only", () => {
    const exams = [{ pct: 0.5 }, { pct: 0.7 }, { pct: 0.9 }];
    expect(Core.mockAverage(exams, 3)).toBeCloseTo(0.7);
    expect(Core.mockAverage(exams, 1)).toBeCloseTo(0.9); // last exam only
    expect(Core.mockAverage(exams, 2)).toBeCloseTo(0.8);
  });

  it("returns null with no exams", () => {
    expect(Core.mockAverage([], 3)).toBe(null);
    expect(Core.mockAverage(undefined, 3)).toBe(null);
  });
});

describe("progressBucket", () => {
  it("buckets match the calibration table boundaries", () => {
    expect(Core.progressBucket(38)).toBe("<50%");
    expect(Core.progressBucket(55)).toBe("50–59%");
    expect(Core.progressBucket(64)).toBe("60–69%");
    expect(Core.progressBucket(72)).toBe("70–79%");
    expect(Core.progressBucket(87)).toBe("80–89%");
    expect(Core.progressBucket(96)).toBe("90–100%");
  });
});

describe("state persistence", () => {
  it("outcomes survive migration and sanitization", () => {
    const s = Core.defaultState();
    s.outcomes = [{ date: NOW, progressPct: 84, mockAvgPct: 88, questionsSeen: 420, studyMinutes: 228, result: "pass" }];
    s.outcomes.push("junk-entry");
    const m = Core.migrateState(s);
    expect(m.state.outcomes).toHaveLength(1);
    expect(m.state.outcomes[0].result).toBe("pass");
  });

  it("outcome journal round-trips through export/import", () => {
    let s = Core.defaultState();
    s.outcomes = Core.appendOutcome(s.outcomes, { progressPct: 71, mockAvgPct: 66, questionsSeen: 150, studyMinutes: 45, result: "fail" }, NOW);
    const r = Core.parseImport(Core.exportBundle(s));
    expect(r.ok).toBe(true);
    expect(r.state.outcomes[0]).toMatchObject({ progressPct: 71, result: "fail" });
  });
});
