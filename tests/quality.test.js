/* REGRESSION: content-integrity gates + prediction-leakage isolation. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";

const data = loadContent();

describe("answer-position balance", () => {
  it("shipped bank has no dominant position (82%-at-B bug stays dead)", () => {
    const r = runChecks(data);
    expect(r.errors.filter((e) => e.rule === "answer-bias")).toEqual([]);
  });

  it("a planted 82%-at-one-position bank FAILS", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    // force most answers back to position 1 by rotating arrays
    let n = 0;
    for (const q of mutated.QUESTIONS) {
      if (q.a !== 1 && n < 200 && q.choices.length >= 2) {
        const [c] = q.choices.splice(q.a, 1);
        q.choices.splice(1, 0, c);
        q.a = 1;
        n++;
      }
    }
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "answer-bias")).toBe(true);
  });
});

describe("explanation leakage", () => {
  it("shipped bank has no verbatim choice echoed in explanations", () => {
    const r = runChecks(data);
    expect(r.errors.filter((e) => e.rule === "leakage")).toEqual([]);
  });

  it("a planted echo FAILS", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    // plant on a question whose correct answer is long enough to trip the gate
    const target = mutated.QUESTIONS.find(
      (q) => !q.jurisdiction && q.choices[q.a].trim().length >= 25
    );
    expect(target, "need a long-answer question to plant on").toBeTruthy();
    target.why = "Remember: " + target.choices[target.a] + " is the rule.";
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "leakage" && new RegExp(target.id).test(e.msg))).toBe(true);
  });
});

describe("outcome→prediction leakage isolation", () => {
  const bank = Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, cat: "signs" }));
  const fresh = Core.defaultState();

  it("readiness() does not even accept outcome data as input", () => {
    expect(Core.readiness.length).toBe(3); // (questions, qstats, exams) — outcomes unreachable
  });

  it("logged outcomes never change readiness or representative assembly", () => {
    const withHistory = Core.defaultState();
    withHistory.outcomes = [
      { date: NOW(), progressPct: 95, result: "pass" },
      { date: NOW() - 1, progressPct: 40, result: "fail" },
    ];
    withHistory.study.retentionLog = [{ qid: "q1", askedAt: NOW(), right: true }];
    withHistory.exams.push({ date: NOW(), pct: 0.9, correct: 9, total: 10, pass: true });

    const rFresh = Core.readiness(bank, {}, []);
    const rHist = Core.readiness(bank, withHistory.qstats, withHistory.exams);
    expect(rHist).toBeGreaterThan(0); // exams DO count (mocks are practice data)
    expect(rFresh).toBe(0);

    // representative assembly ignores everything about the learner
    const a = Core.assembleExam({ bank, n: 10, samplingMode: "representative", rand: () => 0.3 });
    const b = Core.assembleExam({ bank, n: 10, samplingMode: "representative", rand: () => 0.3 });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    void fresh;
  });

  function NOW() { return Date.parse("2026-08-23T00:00:00Z"); }

  it("exports keep outcomes but predictions cannot be rewritten post-hoc", () => {
    let s = Core.defaultState();
    s.study.enrolledAt = NOW();
    s.study.participantId = "rr-x";
    s.outcomes = Core.appendOutcome(s.outcomes, { progressPct: 84, result: "pass" }, NOW());
    s.predictions = [Core.freezePrediction(s.predictions, "rr-x", "PA", {
      readinessPct: 72, mockAvgPct: 70, coveragePct: 65, stabilitySpread: 8,
      questionsSeen: 210, studyMinutes: 180, skillsRated: { mirrors: "good" }, bank,
    }, { intendedTestDate: "2026-09-01", nowMs: NOW() })];
    const exp1 = Core.buildStudyExport(s, bank, NOW());
    const r = Core.parseImport(Core.exportBundle(s), { packIds: ["generic"] });
    const exp2 = Core.buildStudyExport(r.state, bank, NOW());
    expect(exp2.outcomes).toEqual(exp1.outcomes);
    expect(exp2.predictions).toEqual(exp1.predictions);
  });
});
