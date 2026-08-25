/* REGRESSION: learner-study measurement gate + frozen protocol envelope.
   A lone diagnostic must NEVER count as a measured 0-point improvement. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-08-23T12:00:00Z");
const DAY = Core.DAY_MS;
const bank = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, cat: "signs" }));

const exam = (daysAgo, pct, tag) => ({
  date: NOW - daysAgo * DAY,
  pct,
  tag,
  label: tag === "diagnostic" ? "Baseline Diagnostic" : "Mock Exam",
});

describe("improvement gate", () => {
  it("lone diagnostic → improvement is null, NOT a fake 0", () => {
    const m = Core.studyMetrics({
      enrolledAt: NOW - 3 * DAY, nowMs: NOW, answered: 40, timeStudied: 900,
      exams: [exam(3, 0.64, "diagnostic")],
      study: { retentionLog: [] },
    });
    expect(m.diagnosticPct).toBe(64);
    expect(m.latestMockPct).toBe(null);
    expect(m.improvementPct).toBe(null);
  });

  it("diagnostic + later non-diagnostic mock measures real improvement", () => {
    const m = Core.studyMetrics({
      enrolledAt: NOW - 10 * DAY, nowMs: NOW, answered: 420, timeStudied: 10440,
      exams: [
        exam(9, 0.64, "diagnostic"),
        exam(5, 0.75),
        exam(1, 0.87),
      ],
      study: { retentionLog: [] },
    });
    expect(m.diagnosticPct).toBe(64);
    expect(m.latestMockPct).toBe(87);
    expect(m.improvementPct).toBe(23);
    // official simulations and practice mocks both count as follow-ups
    expect(m.mockCount).toBe(2);
  });

  it("a SECOND diagnostic after the first does not count as improvement evidence by itself", () => {
    const m = Core.studyMetrics({
      enrolledAt: NOW - 8 * DAY, nowMs: NOW, answered: 60, timeStudied: 1200,
      exams: [
        exam(7, 0.5, "diagnostic"),
        exam(2, 0.7, "diagnostic"), // retaken diagnostic — not practice
      ],
      study: { retentionLog: [] },
    });
    expect(m.improvementPct).toBe(null);
  });

  it("follow-up taken BEFORE an untagged first exam still gates correctly (baseline falls back)", () => {
    const m = Core.studyMetrics({
      enrolledAt: NOW - 6 * DAY, nowMs: NOW, answered: 30, timeStudied: 600,
      exams: [
        exam(4, 0.55),               // untagged practice mock (earliest)
        exam(3, 0.6, "diagnostic"),  // baseline
        exam(1, 0.9),                // follow-up after baseline
      ],
      study: { retentionLog: [] },
    });
    expect(m.diagnosticPct).toBe(60);
    expect(m.improvementPct).toBe(30);
  });
});

describe("protocol envelope (frozen before recruiting)", () => {
  const stateLike = {
    enrolledAt: NOW, answered: 100, timeStudied: 3600,
    exams: [exam(1, 0.8)], study: { retentionLog: [] },
    settings: { statePack: "CA" },
  };

  it("every export carries the full protocol envelope", () => {
    const exp = Core.buildStudyExport(stateLike, bank, NOW, { appVersion: "1.1.0" });
    expect(exp.protocol).toEqual({
      protocolVersion: "rr-study-1.0",
      contentVersion: expect.stringMatching(/^\d+-[0-9a-f]+$/),
      scoringVersion: "scoring-1",
      masteryVersion: "mastery-v3-concepts",
      jurisdiction: "CA",
      appVersion: "1.1.0",
    });
  });

  it("contentVersion changes when the bank changes", () => {
    const v1 = Core.bankFingerprint(bank);
    const v2 = Core.bankFingerprint(bank.concat([{ id: "qNEW", cat: "signs" }]));
    expect(v1).not.toBe(v2);
    expect(Core.bankFingerprint([...bank].reverse())).toBe(v1); // order-independent
  });

  it("jurisdiction travels with the export so cohorts never mix states silently", () => {
    const exp = Core.buildStudyExport({ ...stateLike, settings: { statePack: "TX" } }, bank, NOW);
    expect(exp.protocol.jurisdiction).toBe("TX");
  });
});
