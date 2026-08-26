/* REGRESSION: prospective OfficialTestPrediction — immutable, leakage-free,
   one outcome per attempt, full provenance. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-08-23T12:00:00Z");
const bank = Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, cat: "signs" }));

function freeze(over = {}, snap = {}) {
  return Core.freezePrediction([], "rr-part1", "PA", {
    readinessPct: 72,
    mockAvgPct: 70,
    diagnosticPct: null,          // missing stays null (item 6)
    coveragePct: 65,
    stabilitySpread: 8,
    questionsSeen: 210,
    studyMinutes: 180,
    bank,
    ...snap,
  }, { intendedTestDate: "2026-09-01", nowMs: NOW, ...over });
}

describe("prospective predictions", () => {
  it("freezes the pre-test state with full version provenance; outcome starts null", () => {
    const p = freeze();
    expect(p.readinessPct).toBe(72);
    expect(p.diagnosticPct).toBe(null);            // item 6: null, not zero
    expect(p.readinessEngineVersion).toBeTruthy();
    expect(p.scoringVersion).toBe("scoring-1");
    expect(p.protocolVersion).toBe("rr-study-1.0");
    expect(p.contentVersion).toMatch(/^\d+-[0-9a-f]+$/);
    expect(p.jurisdiction).toBe("PA");
    expect(p.evidenceClass).toBe("moderate");
    expect(p.outcome).toBe(null);
  });

  it("post-result study cannot alter the frozen prediction (72 → pass stays 72)", () => {
    let p = freeze();
    // learner state later becomes 88 — irrelevant, nothing recomputes
    const attached = Core.attachOutcome(p, "pass", "2026-09-01", NOW + 5 * Core.DAY_MS);
    expect(attached.readinessPct).toBe(72);        // item 4
    expect(attached.outcome.result).toBe("pass");
  });

  it("attachOutcome never calls readiness() and never mutates its input", () => {
    const p = freeze();
    const before = JSON.stringify(p);
    const after = Core.attachOutcome(p, "fail", "2026-09-01", NOW);
    expect(JSON.stringify(p)).toBe(before);        // pure
    expect(after).not.toBe(p);
    void before;
  });

  it("one outcome per attempt; corrections update via re-audit path", () => {
    const p = freeze();
    const once = Core.attachOutcome(p, "pass", "2026-09-01", NOW);
    const twice = Core.attachOutcome(once, "fail", "2026-09-02", NOW + DAY());
    expect(twice.outcome.result).toBe("pass");     // item 10: immutable once set
  });

  it("attempt numbers increment per participant only", () => {
    let preds = [];
    preds.push(Core.freezePrediction(preds, "A", "CA", snap(), { nowMs: NOW }));
    preds.push(Core.freezePrediction(preds, "B", "NY", snap(), { nowMs: NOW }));
    preds.push(Core.freezePrediction(preds, "A", "CA", snap(), { nowMs: NOW + Core.DAY_MS }));
    expect(preds.map((p) => p.attemptNumber)).toEqual([1, 1, 2]);
  });
});

function DAY() { return 86400000; }
function snap() {
  return { readinessPct: 60, coveragePct: 40, skillsRated: { mirrors: "good" }, bank };
}
