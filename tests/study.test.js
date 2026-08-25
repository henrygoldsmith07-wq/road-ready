/* Learner study instrumentation: enrollment, metrics, retention, export */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-08-23T12:00:00Z");
const DAY = Core.DAY_MS;

const bank = [];
for (let i = 0; i < 12; i++) bank.push({ id: `q${i}`, cat: "signs", q: `Q${i}?`, choices: ["a", "b"], a: 0, why: "w" });

describe("enrollment", () => {
  it("creates an anonymous rr- prefixed id", () => {
    const e = Core.createEnrollment(NOW);
    expect(e.participantId).toMatch(/^rr-[0-9a-f]{8}$/);
    expect(e.enrolledAt).toBe(NOW);
  });

  it("ids are effectively unique across participants", () => {
    const ids = new Set(Array.from({ length: 200 }, () => Core.createEnrollment(NOW).participantId));
    expect(ids.size).toBeGreaterThan(190);
  });
});

describe("retention probes (7-day memory checks)", () => {
  const old = NOW - 8 * DAY;
  const recent = NOW - 2 * DAY;

  function makeStats(entries) {
    const qstats = {};
    for (const [id, st] of Object.entries(entries)) { qstats[id] = { lastSeen: 0, ...st }; }
    for (const q of bank) qstats[q.id] ||= { seen: 0, correct: 0, wrong: 0 };
    return qstats;
  }

  it("selects only learned questions seen ≥7 days ago", () => {
    const qstats = makeStats({
      q0: { seen: 3, correct: 3, wrong: 0, lastSeen: old },
      q1: { seen: 3, correct: 0, wrong: 3, lastSeen: old },   // never learned
      q2: { seen: 3, correct: 3, wrong: 0, lastSeen: recent }, // too recent
    });
    const pool = Core.retentionProbePool(bank, qstats, [], NOW);
    expect(pool.map((q) => q.id)).toEqual(["q0"]);
  });

  it("caps probe size and skips already-probed questions", () => {
    const entries = {};
    bank.forEach((q) => { entries[q.id] = { seen: 4, correct: 4, wrong: 0, lastSeen: old - q.id.length }; });
    let log = [{ qid: "q0", askedAt: NOW, right: true }, { qid: "q1", askedAt: NOW, right: false }];
    const pool = Core.retentionProbePool(bank, makeStats(entries), log, NOW);
    expect(pool.length).toBeLessThanOrEqual(Core.RETENTION_PROBE_SIZE);
    expect(pool.some((q) => q.id === "q0" || q.id === "q1")).toBe(false);
  });

  it("orders candidates oldest-first", () => {
    const entries = {};
    bank.forEach((q) => { entries[q.id] = { seen: 4, correct: 4, wrong: 0, lastSeen: old - Number(q.id.slice(1)) * DAY }; });
    const pool = Core.retentionProbePool(bank, makeStats(entries), [], NOW);
    expect(Number(pool[0].id.slice(1))).toBeGreaterThan(Number(pool[1].id.slice(1)));
  });
});

describe("study metrics", () => {
  const stateLike = {
    enrolledAt: NOW - 10 * DAY,
    nowMs: NOW,
    answered: 420,
    timeStudied: 3600 * 2.9,
    exams: [
      { date: NOW - 9 * DAY, pct: 0.64, tag: "diagnostic", label: "Baseline Diagnostic", correct: 13, total: 20 },
      { date: NOW - 5 * DAY, pct: 0.75, label: "Mock Exam", correct: 15, total: 20 },
      { date: NOW - 1 * DAY, pct: 0.87, label: "Mock Exam", correct: 17, total: 20 },
    ],
    study: { confidence: [{ catId: "signs", level: 3 }], retentionLog: [{ right: true }, { right: true }, { right: false }] },
  };

  it("computes the headline numbers from the user's example", () => {
    const m = Core.studyMetrics(stateLike);
    expect(m.diagnosticPct).toBe(64);
    expect(m.latestMockPct).toBe(87);
    expect(m.improvementPct).toBe(23);
    expect(m.questionsAnswered).toBe(420);
    expect(m.studyHours).toBe(2.9);
    expect(m.daysSinceEnroll).toBe(10);
    expect(m.retentionRate).toBeCloseTo(2 / 3);
  });

  it("improvement is null without exams", () => {
    const m = Core.studyMetrics({ ...stateLike, exams: [] });
    expect(m.improvementPct).toBe(null);
    expect(m.diagnosticPct).toBe(null);
  });

  it("untagged legacy exams never fabricate a baseline (strict protocol)", () => {
    const exams = stateLike.exams.map(({ tag, ...e }) => e);
    const m = Core.studyMetrics({ ...stateLike, exams });
    // no tagged diagnostic → no baseline, no improvement measurement
    expect(m.diagnosticPct).toBe(null);
    expect(m.improvementPct).toBe(null);
  });
});

describe("study export (privacy-first)", () => {
  it("exports metrics + timeline with no free-text notes", () => {
    const s = Core.defaultState();
    s.study.enrolledAt = NOW;
    s.study.participantId = "rr-deadbeef";
    s.study.retentionLog = [{ qid: "sg01", askedAt: NOW, right: true }];
    s.exams.push({ date: NOW, pct: 0.8, correct: 16, total: 20, pass: true });
    s.practical.log = [{ date: NOW, minutes: 30, conditions: [], roadTypes: [], skills: { mirrors: "good" }, notes: "Instructor: Jane, phone 555-1234 — private!" }];
    s.outcomes = [{ date: NOW, progressPct: 70, mockAvgPct: 65, questionsSeen: 100, studyMinutes: 60, result: "pass" }];

    const exp = Core.buildStudyExport(s, bank, NOW);
    expect(exp.schema).toBe("road-ready-study@2");
    expect(exp.participantId).toBe("rr-deadbeef");
    expect(exp.metrics.latestMockPct).toBe(null); // no tagged diagnostic → no measured follow-up
    expect(exp.timeline.exams).toHaveLength(1);
    const raw = JSON.stringify(exp);
    expect(raw).not.toContain("Jane");
    expect(raw).not.toContain("555-1234");   // practical NOTES stripped
    expect(raw).toContain('"minutes":30');  // but session minutes kept
    expect(raw).toContain("sg01");           // retention log keeps question ids
  });

  it("export survives the report script's schema gate", async () => {
    const s = Core.defaultState();
    s.study.enrolledAt = NOW;
    s.study.participantId = "rr-test0001";
    const exp = Core.buildStudyExport(s, bank, NOW);
    expect(exp.schema).toBe("road-ready-study@2");
  });
});
