/* REGRESSION: local calendar days, malformed practical state, daily prescription,
   and prospective prediction persistence. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-08-23T12:00:00Z");

describe("local calendar dates", () => {
  it("uses the learner's local calendar day, not the UTC day", () => {
    const lateEvening = new Date(2026, 7, 23, 23, 30);
    expect(Core.localDay(lateEvening)).toBe("2026-08-23");
    const afterMidnight = new Date(2026, 7, 24, 0, 1);
    expect(Core.localDay(afterMidnight)).toBe("2026-08-24");
  });

  it("walks across local midnight and daylight-saving changes", () => {
    expect(Core.localDayBefore("2026-03-30", 1)).toBe("2026-03-29");
    expect(Core.localDayBefore("2026-11-01", 1)).toBe("2026-10-31");
    expect(Core.daysBetweenLocalDates("2026-03-27", "2026-03-31")).toBe(4);
    expect(Core.daysBetweenLocalDates("2026-10-30", "2026-11-02")).toBe(3);
  });

  it("counts local calendar days without UTC clock drift", () => {
    expect(Core.daysBetweenLocalDates("2026-08-23", "2026-08-23")).toBe(0);
    expect(Core.daysBetweenLocalDates("2026-08-23", "2026-09-04")).toBe(12);
    expect(Core.validIsoDate("2026-02-30")).toBe(false);
  });
});

describe("practical state robustness", () => {
  it("normalizes a legacy state that stored practical as an array", () => {
    const session = { date: NOW, minutes: 40, conditions: ["wet"], roadTypes: ["urban"], skills: { mirrors: "good" }, notes: "" };
    const legacy = { practical: [session, { garbage: true }] };
    const m = Core.migrateState(legacy);
    expect(Array.isArray(m.state.practical)).toBe(false);
    expect(m.state.practical.log).toHaveLength(1);
    expect(m.state.practical.log[0].skills.mirrors).toBe("good");
  });

  it("practicalLog accepts current and legacy shapes without treating practical as an array", () => {
    const session = { date: NOW, minutes: 30, conditions: [], roadTypes: [], skills: { mirrors: "ok" }, notes: "" };
    expect(Core.practicalLog({ practical: { log: [session] } })).toEqual([session]);
    expect(Core.practicalLog({ practical: [session] })).toEqual([session]);
    expect(Core.practicalLog({ practical: null })).toEqual([]);
  });

  it("preserves a practical session through migration, export and import", () => {
    let s = Core.defaultState();
    s.practical.log = Core.appendPracticalSession(s.practical.log, {
      minutes: 52,
      conditions: ["dry"],
      roadTypes: ["urban"],
      skills: { mirrors: "good", "roundabout-entry-lane": "ok" },
      notes: "private note",
    }, NOW);
    const imported = Core.parseImport(Core.exportBundle(s));
    expect(imported.ok).toBe(true);
    expect(imported.state.practical.log[0].skills["roundabout-entry-lane"]).toBe("ok");
  });
});

describe("daily study prescription", () => {
  const bank = [
    { id: "a1", cat: "row", concept: "junction-priority", choices: [], a: 0 },
    { id: "a2", cat: "row", concept: "junction-priority", choices: [], a: 0 },
    { id: "a3", cat: "row", concept: "junction-priority", choices: [], a: 0 },
    { id: "b1", cat: "signs", concept: "road-markings", choices: [], a: 0 },
    { id: "b2", cat: "signs", concept: "road-markings", choices: [], a: 0 },
    { id: "c1", cat: "safety", concept: "following-distance", choices: [], a: 0 },
    { id: "c2", cat: "safety", concept: "following-distance", choices: [], a: 0 },
  ];
  const qstats = {
    a1: { seen: 2, correct: 0, wrong: 2, sched: { due: NOW - Core.DAY_MS, ef: 2.5, interval: 1, reps: 1 } },
    b1: { seen: 1, correct: 0, wrong: 1 },
  };

  it("selects weak concepts, overdue reviews and unseen work with a rationale", () => {
    const rec = Core.dailyStudyRecommendation({ bank, qstats, exams: [], daily: {}, testDate: "2026-09-04", today: "2026-08-23", nowMs: NOW });
    expect(rec.questions).toBeGreaterThan(0);
    expect(rec.focusConcepts).toContain("junction-priority");
    expect(rec.reviewDue).toBe(1);
    expect(rec.unseenNeeded).toBeGreaterThan(0);
    expect(rec.estimatedMinutes).toBeGreaterThan(0);
    expect(rec.rationale.length).toBeGreaterThan(0);
    expect(rec.confidence).toBe("high");
  });

  it("keeps the final day short instead of prescribing a cram session", () => {
    const rec = Core.dailyStudyRecommendation({ bank, qstats, exams: [], daily: {}, testDate: "2026-08-23", today: "2026-08-23", nowMs: NOW });
    expect(rec.action).toBe("review");
    expect(rec.questions).toBeLessThanOrEqual(12);
  });

  it("subtracts work already completed today", () => {
    const rec = Core.dailyStudyRecommendation({ bank, qstats, exams: [], daily: { "2026-08-23": 3 }, testDate: "2026-09-04", today: "2026-08-23", nowMs: NOW });
    expect(rec.todayCount).toBe(3);
    expect(rec.questions).toBeLessThanOrEqual(Math.max(0, bank.length));
  });
});

describe("prospective prediction persistence", () => {
  const bank = Array.from({ length: 12 }, (_, i) => ({ id: `q${i}`, cat: "signs" }));

  it("clamps invalid prediction records instead of persisting garbage", () => {
    const migrated = Core.migrateState({
      v: Core.SCHEMA_VERSION,
      predictions: [{ id: 42, readinessPct: 999, outcome: { result: "maybe" } }, "junk"],
    });
    expect(migrated.state.predictions).toHaveLength(1);
    expect(migrated.state.predictions[0].readinessPct).toBe(100);
    expect(migrated.state.predictions[0].outcome.result).toBe("unknown");
  });

  it("stores the full calibration feature set and survives export/import", () => {
    let s = Core.defaultState();
    s.answered = 210;
    s.timeStudied = 180 * 60;
    s.exams.push({ date: NOW, pct: 0.78, correct: 39, total: 50, pass: false });
    s.exams.push({ date: NOW + Core.DAY_MS, pct: 0.84, correct: 42, total: 50, pass: true });
    s.practical.log.push({ date: NOW, minutes: 40, conditions: [], roadTypes: [], skills: { mirrors: "good" }, notes: "" });
    const snapshot = {
      readinessPct: 72,
      mockAvgPct: 81,
      diagnosticPct: 66,
      coveragePct: 65,
      stabilitySpread: 6,
      questionsSeen: 210,
      studyMinutes: 180,
      skillsRated: { mirrors: "good" },
      bank,
    };
    s.predictions = [Core.freezePrediction(s.predictions, "rr-x", "UK", snapshot, {
      intendedTestDate: "2026-09-01", nowMs: NOW, appVersion: "1.1.0",
    })];
    const r = Core.parseImport(Core.exportBundle(s), { packIds: ["UK"] });
    const p = r.state.predictions[0];
    expect(p).toMatchObject({
      readinessPct: 72,
      mockAvgPct: 81,
      diagnosticPct: 66,
      coveragePct: 65,
      stabilitySpread: 6,
      questionsSeen: 210,
      studyMinutes: 180,
      jurisdiction: "UK",
      intendedTestDate: "2026-09-01",
      appVersion: "1.1.0",
    });
    expect(p.outcome).toBe(null);
  });

  it("keeps a frozen snapshot unchanged while a later outcome is attached", () => {
    const before = Core.freezePrediction([], "rr-y", "CA", {
      readinessPct: 64,
      mockAvgPct: 70,
      coveragePct: 55,
      stabilitySpread: 10,
      questionsSeen: 80,
      studyMinutes: 90,
      skillsRated: {},
      bank,
    }, { intendedTestDate: "2026-09-01", nowMs: NOW });
    const after = Core.attachOutcome(before, "fail", "2026-09-01", NOW + Core.DAY_MS);
    expect(after.readinessPct).toBe(64);
    expect(after.mockAvgPct).toBe(70);
    expect(after.outcome.result).toBe("fail");
    expect(before.outcome).toBe(null);
  });
});
