/* localStorage migration & versioning */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

describe("state migration", () => {
  it("legacy v1 payload (no version marker) migrates cleanly to v2", () => {
    const legacy = {
      qstats: { sg01: { seen: 3, correct: 2, wrong: 1 } },
      flagged: { sg02: true },
      exams: [{ date: 1700000000000, label: "Mock Exam", pct: 0.9, correct: 18, total: 20, pass: true }],
      answered: 42,
      correctCount: 30,
      streak: { count: 4, last: "2026-08-20" },
      fcKnown: { stop: true },
      achievements: { "first-steps": 1700000000000 },
      xp: 260,
      timeStudied: 900,
      hazardBest: 12,
      settings: { passMark: 0.75, theme: "light" },
      todayDate: "2026-08-21",
      todayCount: 7,
    };
    const m = Core.migrateState(legacy);
    expect(m.warnings).toEqual([]);
    expect(m.state.v).toBe(Core.SCHEMA_VERSION);
    // data preserved
    expect(m.state.answered).toBe(42);
    expect(m.state.qstats.sg01.seen).toBe(3);
    expect(m.state.xp).toBe(260);
    expect(m.state.streak.count).toBe(4);
    expect(m.state.settings.passMark).toBe(0.75);
    expect(m.state.settings.theme).toBe("light");
    // v2 additions
    expect(m.state.settings.statePack).toBe("generic");
    expect(m.state.daily).toEqual({});
    expect(m.state.todayDate).toBeUndefined(); // transient fields dropped
  });

  it("current-version payloads round-trip unchanged", () => {
    const s = Core.defaultState();
    s.answered = 5;
    s.qstats.a1 = { seen: 2, correct: 1, wrong: 1 };
    const m = Core.migrateState(s);
    expect(m.warnings).toEqual([]);
    expect(m.state.answered).toBe(5);
    expect(m.state.qstats.a1.sched.ef).toBe(2.5); // sched normalized in
  });

  it("future versions are flagged, not destroyed", () => {
    const future = Object.assign(Core.defaultState(), { v: 99, brandNewField: { a: 1 } });
    const m = Core.migrateState(future);
    expect(m.warnings.some((w) => w.startsWith("future-version"))).toBe(true);
    expect(m.state.answered).toBe(0);
  });

  it("corrupt JSON yields a fresh state with a warning", () => {
    const m = Core.migrateState("{not json!!");
    expect(m.warnings).toContain("corrupt-json");
    expect(m.state.v).toBe(Core.SCHEMA_VERSION);
  });

  it("garbage payloads never throw", () => {
    expect(() => Core.migrateState(null)).not.toThrow();
    expect(() => Core.migrateState(42)).not.toThrow();
    expect(() => Core.migrateState([1, 2])).not.toThrow();
    expect(() => Core.migrateState({ qstats: { x: "junk" }, settings: { passMark: 99 } })).not.toThrow();
  });

  it("sanitizer clamps corrupt numbers and types", () => {
    const m = Core.migrateState({
      v: 2,
      answered: -5,
      correctCount: 999,
      xp: "lots",
      hazardBest: 400,
      exams: [{ date: "nope", pct: 7, correct: -1, total: 0, pass: "yes" }, "junk-entry"],
      settings: { passMark: 4, examLen: 1000, theme: "solarized" },
      streak: "three",
    });
    expect(m.state.answered).toBe(0);
    expect(m.state.correctCount).toBe(0); // clamped to ≤ answered
    expect(m.state.xp).toBe(0);
    expect(m.state.hazardBest).toBeLessThanOrEqual(75);
    expect(m.state.exams.length).toBe(1); // non-objects dropped
    expect(m.state.exams[0].pass).toBe(false);
    expect(m.state.settings.passMark).toBeGreaterThanOrEqual(0.5);
    expect(m.state.settings.examLen).toBeLessThanOrEqual(100);
    expect(m.state.settings.theme).toBe("dark");
    expect(m.state.streak.count).toBe(0);
  });

  it("JSON string input works (as stored in localStorage)", () => {
    const s = Core.defaultState();
    s.flagged.sg09 = true;
    const m = Core.migrateState(JSON.stringify(s));
    expect(m.state.flagged.sg09).toBe(true);
  });

  it("exam history is capped to MAX_EXAM_HISTORY", () => {
    const s = Core.defaultState();
    s.exams = Array.from({ length: 50 }, (_, i) => ({ date: i, label: "E", pct: 0.5, correct: 10, total: 20, pass: false }));
    expect(Core.migrateState(s).state.exams.length).toBe(Core.MAX_EXAM_HISTORY);
  });

  it("preserves valid test dates and drops impossible ones", () => {
    const s = Core.defaultState();
    s.settings.testDate = "2026-10-14";
    expect(Core.migrateState(s).state.settings.testDate).toBe("2026-10-14");
    s.settings.testDate = "2026-02-31";
    expect(Core.migrateState(s).state.settings.testDate).toBe("");
  });
});
