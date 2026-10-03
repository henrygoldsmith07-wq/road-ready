/* Adaptive Coach engine: deterministic recommendations, misconception ledger,
   session deltas, review groups, mock debrief + post-mock drill. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import Coach from "../js/coach.js";

const DAY = Core.DAY_MS;
const NOW = Date.parse("2026-10-02T09:00:00Z");
const TODAY = "2026-10-02";

const q = (id, cat, concept) => ({ id, cat, concept, q: `Question ${id}?`, choices: ["a", "b", "c"], a: 0, why: "because" });

function bank() {
  return [
    q("j1", "row", "junction-priority"),
    q("j2", "row", "junction-priority"),
    q("j4", "row", "junction-priority"),
    q("j3", "row", "roundabout-priority"),
    q("s1", "signs", "sign-shape"),
    q("s2", "signs", "sign-shape"),
    q("s4", "signs", "sign-shape"),
    q("s3", "signs", "sign-color"),
    q("v1", "vulnerable", "cyclist-space"),
    q("v2", "vulnerable", "cyclist-space"),
    q("v3", "vulnerable", "cyclist-space"),
  ];
}

describe("concept diagnosis", () => {
  it("groups questions into concepts with encounters, coverage and mastery", () => {
    const b = bank();
    const qstats = {
      j1: { seen: 3, correct: 3, wrong: 0 },
      j2: { seen: 2, correct: 1, wrong: 1 },
    };
    const diags = Coach.conceptDiagnosis(b, qstats, NOW);
    const jp = diags.find((d) => d.key === "junction-priority");
    expect(jp.encounters).toBe(5);
    expect(jp.unseen).toBe(1); // j4 is a never-attempted variant of the concept
    expect(jp.mastery).toBeGreaterThan(0);
    const rs = diags.find((d) => d.key === "roundabout-priority");
    expect(rs.unseen).toBe(1);
    expect(rs.mastery).toBe(0);
  });

  it("classifies issue kinds honestly", () => {
    const b = bank();
    // knowledge: wrong with no right
    let d = Coach.conceptDiagnosis(b, { j1: { seen: 2, correct: 0, wrong: 2 } }, NOW)[0];
    expect(Coach.issueKind(d, null)).toBe("knowledge");
    // fluency: right but slow
    d = Coach.conceptDiagnosis(b, {
      j1: { seen: 4, correct: 4, wrong: 0, slowRight: 2 },
      j2: { seen: 4, correct: 4, wrong: 0 },
    }, NOW)[0];
    expect(Coach.issueKind(d, null)).toBe("fluency");
    // coverage: untouched
    d = Coach.conceptDiagnosis(b, {}, NOW).find((x) => x.key === "sign-shape");
    expect(Coach.issueKind(d, null)).toBe("coverage");
    // retention: learned, then overdue
    d = Coach.conceptDiagnosis(b, {
      j1: { seen: 4, correct: 4, wrong: 0, sched: { due: NOW - 3 * DAY, ef: 2.5, interval: 6, reps: 2 } },
      j2: { seen: 4, correct: 4, wrong: 0 },
    }, NOW)[0];
    expect(Coach.issueKind(d, null)).toBe("retention");
    // stable
    d = Coach.conceptDiagnosis(b, {
      j1: { seen: 4, correct: 4, wrong: 0 },
      j2: { seen: 4, correct: 4, wrong: 0 },
    }, NOW)[0];
    expect(Coach.issueKind(d, null)).toBe("stable");
  });
});

describe("misconception ledger", () => {
  it("tracks errors at concept level and escalates stage on repeats", () => {
    let m = {};
    m = Coach.recordMisconception(m, "junction-priority", "j1", NOW);
    expect(m["junction-priority"].errors).toBe(1);
    expect(m["junction-priority"].stage).toBe(1);
    m = Coach.recordMisconception(m, "junction-priority", "j2", NOW + 1);
    expect(m["junction-priority"].stage).toBe(2);
    m = Coach.recordMisconception(m, "junction-priority", "j1", NOW + 2);
    expect(m["junction-priority"].stage).toBe(3);
    expect(m["junction-priority"].questionIds).toEqual(["j1", "j2"]);
  });

  it("a single repeat of the same question does not prove repair; a variant does", () => {
    let m = Coach.recordMisconception({}, "junction-priority", "j1", NOW);
    // same question correct once — still active
    m = Coach.noteConceptSuccess(m, "junction-priority", "j1", NOW + DAY);
    expect(m["junction-priority"].repairedAt).toBeFalsy();
    // a different question of the same concept — repair
    m = Coach.noteConceptSuccess(m, "junction-priority", "j2", NOW + 2 * DAY);
    expect(m["junction-priority"].repairedAt).toBeTruthy();
    expect(Coach.activeMisconceptions(m)).toHaveLength(0);
  });

  it("two correct answers of the same question also count as repair", () => {
    let m = Coach.recordMisconception({}, "sign-shape", "s1", NOW);
    m = Coach.noteConceptSuccess(m, "sign-shape", "s1", NOW + DAY);
    expect(m["sign-shape"].repairedAt).toBeFalsy();
    m = Coach.noteConceptSuccess(m, "sign-shape", "s1", NOW + 2 * DAY);
    expect(m["sign-shape"].repairedAt).toBeTruthy();
  });

  it("a fresh error reopens a repaired misconception", () => {
    let m = Coach.recordMisconception({}, "sign-shape", "s1", NOW);
    m = Coach.noteConceptSuccess(m, "sign-shape", "s2", NOW + DAY);
    expect(m["sign-shape"].repairedAt).toBeTruthy();
    m = Coach.recordMisconception(m, "sign-shape", "s1", NOW + 2 * DAY);
    expect(m["sign-shape"].repairedAt).toBeNull();
  });

  it("builds a hedged confusion line from verified bank content only", () => {
    const b = bank();
    const m = Coach.recordMisconception({}, "junction-priority", "j1", NOW);
    const line = Coach.confusionLine(m["junction-priority"] && { ...m["junction-priority"], key: "junction-priority" }, b, {});
    expect(line).not.toBeNull();
    expect(line.text).toMatch(/may be mixing up/i);
  });
});

describe("recommendations", () => {
  it("fix-misconception outranks everything when a repeated error exists", () => {
    const b = bank();
    let m = Coach.recordMisconception({}, "junction-priority", "j1", NOW);
    m = Coach.recordMisconception(m, "junction-priority", "j2", NOW + 1);
    const plan = Coach.recommend({
      bank: b,
      qstats: {
        j1: { seen: 3, correct: 1, wrong: 2, fastWrong: 1 },
        j2: { seen: 2, correct: 0, wrong: 2 },
      },
      misconceptions: m,
      exams: [], daily: {}, today: TODAY, nowMs: NOW,
    });
    expect(plan.primary.type).toBe(Coach.REC_TYPES.FIX_MISCONCEPTION);
    expect(plan.primary.issueKind).toBe("misconception");
    expect(plan.primary.conceptKeys).toContain("junction-priority");
    expect(plan.primary.questionCount).toBeGreaterThan(0);
  });

  it("overdue reviews produce review-overdue with a concrete count", () => {
    const b = bank();
    const mk = () => ({ seen: 4, correct: 4, wrong: 0, sched: { due: NOW - 3 * DAY, ef: 2.5, interval: 6, reps: 2 } });
    const plan = Coach.recommend({
      bank: b,
      qstats: { j1: mk(), j2: mk(), s1: mk() },
      misconceptions: {}, exams: [], daily: {}, today: TODAY, nowMs: NOW,
    });
    expect(plan.primary.type).toBe(Coach.REC_TYPES.REVIEW_OVERDUE);
    expect(plan.primary.issueKind).toBe("retention");
    expect(plan.primary.questionCount).toBe(3);
  });

  it("slow-but-right concepts produce a fluency drill", () => {
    const b = bank();
    const mastered = { seen: 5, correct: 5, wrong: 0 };
    const plan = Coach.recommend({
      bank: b,
      qstats: {
        j1: { seen: 5, correct: 5, wrong: 0, slowRight: 2 },
        j2: { ...mastered }, j4: { ...mastered },
        s1: { ...mastered }, s2: { ...mastered }, s4: { ...mastered },
        s3: { seen: 5, correct: 5, wrong: 0, slowRight: 2 },
        v1: { ...mastered }, v2: { ...mastered }, v3: { ...mastered },
      },
      misconceptions: {}, exams: [], daily: {}, today: TODAY, nowMs: NOW,
    });
    expect(plan.primary.type).toBe(Coach.REC_TYPES.IMPROVE_FLUENCY);
    expect(plan.primary.issueKind).toBe("fluency");
    expect(plan.primary.conceptKeys).toEqual(expect.arrayContaining(["junction-priority", "sign-color"]));
  });

  it("low coverage far from the test produces build-coverage", () => {
    const b = bank();
    const plan = Coach.recommend({
      bank: b,
      qstats: { j1: { seen: 2, correct: 2, wrong: 0 } },
      misconceptions: {}, exams: [], daily: {},
      today: TODAY, testDate: "2026-12-20", nowMs: NOW,
    });
    expect(plan.primary.type).toBe(Coach.REC_TYPES.BUILD_COVERAGE);
    expect(plan.phase).toBe("far");
  });

  it("test-day eve always produces a light review, never a cram", () => {
    const b = bank();
    let m = Coach.recordMisconception({}, "junction-priority", "j1", NOW);
    const plan = Coach.recommend({
      bank: b,
      qstats: { j1: { seen: 3, correct: 1, wrong: 2 } },
      misconceptions: m, exams: [], daily: {},
      today: TODAY, testDate: "2026-10-03", nowMs: NOW,
    });
    expect(plan.primary.type).toBe(Coach.REC_TYPES.LIGHT_REVIEW);
    expect(plan.primary.questionCount).toBeLessThanOrEqual(8);
  });

  it("recommendations are deterministic across runs", () => {
    const b = bank();
    const input = {
      bank: b,
      qstats: { j1: { seen: 3, correct: 1, wrong: 2, fastWrong: 1 } },
      misconceptions: Coach.recordMisconception({}, "junction-priority", "j1", NOW),
      exams: [], daily: {}, today: TODAY, nowMs: NOW,
    };
    const a = JSON.stringify(Coach.recommend(input));
    const b2 = JSON.stringify(Coach.recommend(input));
    expect(a).toBe(b2);
  });

  it("a fresh learner with a big bank gets coverage, not exam verdicts", () => {
    const plan = Coach.recommend({
      bank: bank(), qstats: {}, misconceptions: {}, exams: [], daily: {},
      today: TODAY, testDate: "2026-10-06", nowMs: NOW,
    });
    // 3 days out with 0% coverage: the evidence says cover content first
    expect(plan.primary.type).toBe(Coach.REC_TYPES.BUILD_COVERAGE);
    expect(JSON.stringify(plan)).not.toMatch(/will pass|guaranteed|exam ready/i);
  });
});

describe("session delta", () => {
  it("reports measured change between snapshots in learner language", () => {
    const prev = { coveragePct: 30, masteryPct: 20, masteredConcepts: 1, misconceptionConcepts: 2, overdue: 5, mockPct: 0.6 };
    const curr = { coveragePct: 38, masteryPct: 26, masteredConcepts: 3, misconceptionConcepts: 1, overdue: 2, mockPct: 0.7 };
    const d = Coach.sessionDelta(prev, curr);
    expect(d.lines.join(" ")).toMatch(/Coverage 30% → 38%/);
    expect(d.lines.join(" ")).toMatch(/2 concepts moved to mastered/);
    expect(d.lines.join(" ")).toMatch(/1 misconception cleared/);
    expect(d.changed).toBe(true);
  });

  it("says so honestly when nothing measurable changed", () => {
    const s = { coveragePct: 30, masteryPct: 20, masteredConcepts: 1, misconceptionConcepts: 0, overdue: 0, mockPct: null };
    const d = Coach.sessionDelta(s, { ...s });
    expect(d.changed).toBe(false);
  });
});

describe("review groups", () => {
  it("collapses many missed questions into few concept groups", () => {
    const b = bank();
    const qstats = {
      j1: { seen: 3, correct: 1, wrong: 2, fastWrong: 1 },
      j2: { seen: 3, correct: 1, wrong: 2 },
      s1: { seen: 2, correct: 1, wrong: 1 },
    };
    const rg = Coach.reviewGroups({ bank: b, qstats, misconceptions: {}, nowMs: NOW });
    expect(rg.summary.missedCount).toBe(3);
    expect(rg.summary.conceptCount).toBe(2);
    expect(rg.summary.text).toMatch(/map to only 2 underlying concepts/);
    expect(rg.groups.length).toBeGreaterThan(0);
    for (const g of rg.groups) expect(g.drillIds.length).toBeGreaterThan(0);
  });

  it("misconception patterns outrank plain misses", () => {
    const b = bank();
    let m = Coach.recordMisconception({}, "junction-priority", "j1", NOW);
    m = Coach.recordMisconception(m, "junction-priority", "j2", NOW + 1);
    const rg = Coach.reviewGroups({
      bank: b,
      qstats: { j1: { seen: 3, correct: 1, wrong: 2 }, j2: { seen: 3, correct: 1, wrong: 2 }, s1: { seen: 2, correct: 1, wrong: 1 } },
      misconceptions: m, nowMs: NOW,
    });
    expect(rg.groups[0].id).toBe("misconceptions");
  });

  it("fast-wrong and slow-right get their own groups when present", () => {
    const b = bank();
    const rg = Coach.reviewGroups({
      bank: b,
      qstats: {
        j1: { seen: 3, correct: 1, wrong: 2, fastWrong: 1 },
        s1: { seen: 4, correct: 4, wrong: 0, slowRight: 2 },
      },
      misconceptions: {}, nowMs: NOW,
    });
    const ids = rg.groups.map((g) => g.id);
    expect(ids).toContain("fast-wrong");
    expect(ids).toContain("slow-right");
  });

  it("drill ids prefer fresh variants of the concept over the missed question", () => {
    const b = bank();
    const missedIds = new Set(["j1"]);
    const ids = Coach.drillIdsForConcept("junction-priority", b, {}, missedIds);
    expect(ids[0]).toBe("j2"); // never-missed sibling first
    expect(ids).toContain("j1");
  });
});

describe("mock debrief and post-mock drill", () => {
  const b = bank();
  const answers = [
    { qid: "j1", right: false, rtMs: 2000 },
    { qid: "j2", right: false, rtMs: 9000 },
    { qid: "s1", right: false, rtMs: 3000 },
    { qid: "s2", right: true, rtMs: 25000, learned: true },
    { qid: "v1", right: true, rtMs: 1200 },
    { qid: "v2", right: false, rtMs: 4000, regressed: true },
  ];

  it("summarises topics, concepts and regressions concisely", () => {
    const d = Coach.mockDebrief({
      bank: b, answers, qstats: {}, misconceptions: {}, slowMs: 20000, nowMs: NOW,
      categories: { row: { name: "Right of Way" } },
    });
    expect(d.correct).toBe(2);
    expect(d.topicBreakdown[0].id).toBeTruthy();
    expect(d.conceptWeaknesses.map((x) => x.key)).toContain("junction-priority");
    expect(d.regressions).toHaveLength(1);
    expect(d.recentlyLearned).toHaveLength(1);
    expect(d.slowAnswers).toHaveLength(1);
  });

  it("post-mock drill targets missed CONCEPTS with fresh questions, not replays", () => {
    const drill = Coach.postMockDrill({ bank: b, answers, qstats: {} });
    const answered = new Set(answers.map((a) => a.qid));
    expect(drill.questions.length).toBeGreaterThanOrEqual(3);
    for (const qn of drill.questions) expect(answered.has(qn.id)).toBe(false);
    expect(drill.conceptKeys).toContain("junction-priority");
    expect(drill.reason).toMatch(/different questions/i);
    expect(drill.note).toBeNull();
  });

  it("admits when a concept has no fresh variant and reuses a mock question", () => {
    const tiny = [q("x1", "signs", "only-concept")];
    const drill = Coach.postMockDrill({ bank: tiny, answers: [{ qid: "x1", right: false }], qstats: {} });
    expect(drill.questions.map((x) => x.id)).toContain("x1");
    expect(drill.note).toMatch(/no unseen questions/i);
  });

  it("a clean mock yields an honest empty-target drill", () => {
    const clean = answers.map((a) => ({ ...a, right: true, regressed: false }));
    const drill = Coach.postMockDrill({ bank: b, answers: clean, qstats: {} });
    expect(drill.reason).toMatch(/Nothing missed/i);
  });
});

describe("test-date phases", () => {
  it("maps days left to the right phase", () => {
    expect(Coach.testPhase(null)).toBe("none");
    expect(Coach.testPhase(-1)).toBe("past");
    expect(Coach.testPhase(0)).toBe("eve");
    expect(Coach.testPhase(1)).toBe("eve");
    expect(Coach.testPhase(5)).toBe("final");
    expect(Coach.testPhase(10)).toBe("approach");
    expect(Coach.testPhase(30)).toBe("far");
  });

  it("final-week plans prefer weak areas over broad coverage", () => {
    const b = bank();
    const qstats = {
      j1: { seen: 3, correct: 0, wrong: 3 },
      j2: { seen: 3, correct: 3, wrong: 0 },
    };
    const plan = Coach.recommend({
      bank: b, qstats, misconceptions: {}, exams: [], daily: {},
      today: TODAY, testDate: "2026-10-06", nowMs: NOW,
    });
    expect(["strengthen-weak-topic", "fix-misconception", "review-overdue", "build-coverage"]).toContain(plan.primary.type);
  });
});
