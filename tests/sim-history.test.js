import { describe, expect, it } from "vitest";
import Core from "../js/core.js";

const sim = (over) => Object.assign({
  date: 1_700_000_000_000,
  label: "Test-Day Simulation",
  pct: 0.88,
  correct: 44,
  total: 50,
  pass: false,
  tag: "test-day",
  theory: { correct: 44, total: 50, minCorrect: 43 },
  hazard: { pts: 30, max: 70, passPts: 41 },
}, over);

describe("test-day track record", () => {
  it("normalizes a sim row into per-section verdicts", () => {
    const r = Core.simRecord(sim());
    expect(r.theory).toMatchObject({ correct: 44, total: 50, minCorrect: 43, pass: true });
    expect(r.hazard).toMatchObject({ pts: 30, max: 70, passPts: 41, pass: false });
    expect(r.pass).toBe(false);
  });

  it("ignores non-sim rows and rows without section data gracefully", () => {
    expect(Core.simRecord({ tag: "mock", pct: 0.9 })).toBe(null);
    expect(Core.simRecord(null)).toBe(null);
    // legacy shape: falls back to top-level theory fields, hazard absent = fail
    const r = Core.simRecord({ tag: "test-day", correct: 43, total: 50, minCorrect: 43 });
    expect(r.theory.pass).toBe(true);
    expect(r.hazard.pass).toBe(false);
  });

  it("keeps sim history chronological and excludes regular mocks", () => {
    const rows = Core.simHistory([
      { tag: "mock", pct: 0.7, date: 3 },
      sim({ date: 20 }),
      sim({ date: 10 }),
    ]);
    expect(rows.map((r) => r.date)).toEqual([10, 20]);
  });

  it("summarizes the trend and names the repeat miss", () => {
    expect(Core.simTrend([])).toBe(null);
    expect(Core.simTrend([{ tag: "mock", pct: 1 }])).toBe(null);
    const t = Core.simTrend([
      sim({ date: 1, hazard: { pts: 50, max: 70, passPts: 41 } }), // full pass
      sim({ date: 2 }), // hazard miss
      sim({ date: 3 }), // hazard miss
    ]);
    expect(t.count).toBe(3);
    expect(t.passes).toBe(1);
    expect(t.repeatMiss).toBe("hazard");
    expect(t.lastPass).toBe(false);
    expect(t.text).toContain("3 sittings · 1 full pass · hazard is the repeat miss");
  });

  describe("pre-sim readiness gate (advisory, never blocks)", () => {
    it("stays silent for first-timers with no negative evidence", () => {
      expect(Core.simGate({ readinessPct: 80, exams: [] })).toEqual({ warn: false, lines: [] });
      expect(Core.simGate({ readinessPct: 60, exams: [] }).warn).toBe(false);
    });
    it("warns on early theory readiness", () => {
      const g = Core.simGate({ readinessPct: 30, exams: [] });
      expect(g.warn).toBe(true);
      expect(g.lines[0]).toContain("theory readiness is 30%");
    });
    it("warns on a repeat miss across sittings", () => {
      const g = Core.simGate({
        readinessPct: 85,
        exams: [sim({ date: 1 }), sim({ date: 2 })],
      });
      expect(g.warn).toBe(true);
      expect(g.lines.join(" ")).toContain("hazard is the repeat miss");
    });
    it("combines both lines when both apply", () => {
      const g = Core.simGate({ readinessPct: 20, exams: [sim({ date: 1 })] });
      expect(g.warn).toBe(true);
      expect(g.lines).toHaveLength(2);
    });
  });

  describe("gate analytics (warn/accept/dismiss, local only)", () => {
    it("summarizes warns, accepts and dismisses", () => {
      expect(Core.simGateStats([])).toEqual({ warns: 0, accepts: 0, dismisses: 0 });
      expect(Core.simGateStats([
        { date: 1, lines: ["a"], accepted: true },
        { date: 2, lines: ["a"], accepted: false },
        { date: 3, lines: ["a", "b"], accepted: false },
      ])).toEqual({ warns: 3, accepts: 1, dismisses: 2 });
    });
    it("sanitizer keeps the log bounded and typed", () => {
      const m = Core.migrateState({
        simGateEvents: [
          { date: 1, lines: ["theory readiness is 30% — x".repeat(50)], accepted: true },
          { date: "junk", lines: "not-an-array", accepted: "yes" },
          null,
        ],
      });
      const rows = m.state.simGateEvents;
      expect(rows).toHaveLength(2);
      expect(rows[0].accepted).toBe(true);
      expect(rows[0].lines[0].length).toBeLessThanOrEqual(200);
      expect(rows[1].accepted).toBe(false); // "yes" is not true
      expect(rows[1].lines).toEqual([]);
    });
  });

  it("reports both-sections-clear when every sitting passed", () => {
    const t = Core.simTrend([
      sim({ date: 1, hazard: { pts: 60, max: 70, passPts: 41 }, pass: true }),
    ]);
    expect(t.repeatMiss).toBe(null);
    expect(t.text).toContain("both sections clear");
  });
});
