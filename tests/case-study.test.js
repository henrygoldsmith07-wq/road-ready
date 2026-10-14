/* Case-study clusters (DVSA format fidelity): whole clusters are sampled as one
 * adjacent block in official (representative/fixed) forms, flow as individuals
 * in adaptive practice, and are never examined in part. */
import { describe, expect, it } from "vitest";
import Core from "../js/core.js";
import Coach from "../js/coach.js";
import { runChecks } from "../scripts/content-checks.mjs";
import { loadContent } from "../scripts/content-loader.mjs";

// Deterministic RNG so the test never flakes.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function q(id, cat, extra = {}) {
  return { id, cat, q: `Question ${id}?`, choices: ["a", "b", "c", "d"], a: 0, why: `Because ${id}.`, ...extra };
}

const STEM = "A shared scenario long enough to pass the schema floor of forty characters.";
function clusterBank() {
  const bank = [];
  ["signs", "row", "laws"].forEach((cat) => {
    for (let i = 0; i < 12; i++) bank.push(q(`${cat}${i}`, cat));
  });
  bank.push(
    q("c1", "signs", { caseId: "t-case-alpha", caseStem: STEM }),
    q("c2", "row", { caseId: "t-case-alpha", caseStem: STEM }),
    q("c3", "laws", { caseId: "t-case-alpha", caseStem: STEM }),
    q("d1", "signs", { caseId: "t-case-beta", caseStem: `${STEM} Second story.` }),
    q("d2", "row", { caseId: "t-case-beta", caseStem: `${STEM} Second story.` }),
    q("d3", "laws", { caseId: "t-case-beta", caseStem: `${STEM} Second story.` }),
  );
  return bank;
}

function clusterIds(qs) {
  return qs.map((x) => x.id);
}

describe("case-study assembly", () => {
  it("samples a whole cluster adjacently and preserves the total count", () => {
    const qs = Core.assembleExam({
      bank: clusterBank(), n: 20, samplingMode: "representative",
      rand: mulberry32(7), caseStudySeats: 3,
    });
    expect(qs.length).toBe(20);
    const ids = clusterIds(qs);
    const alpha = ["c1", "c2", "c3"].map((id) => ids.indexOf(id));
    const beta = ["d1", "d2", "d3"].map((id) => ids.indexOf(id));
    const present = (idx) => idx.every((i) => i >= 0);
    // Exactly one of the two clusters is drawn whole; its members sit together.
    expect(present(alpha) !== present(beta)).toBe(true);
    const block = present(alpha) ? alpha : beta;
    const sorted = [...block].sort((a, b) => a - b);
    expect(sorted[2] - sorted[0]).toBe(2);
  });

  it("keeps official forms history-blind when reserving cluster seats", () => {
    const mk = (seed, stats) => Core.assembleExam({
      bank: clusterBank(), n: 20, samplingMode: "representative",
      rand: mulberry32(seed), caseStudySeats: 3, qstats: stats,
    });
    // A learner who failed every cluster question gets the same shape of form:
    // clusters are chosen by lottery, never by weakness.
    const weak = { c1: { asked: 9, wrong: 9 }, c2: { asked: 9, wrong: 9 }, c3: { asked: 9, wrong: 9 } };
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(clusterIds(mk(seed, {})).filter((id) => /^[cd][123]$/.test(id)).length).toBe(3);
      expect(clusterIds(mk(seed, weak)).filter((id) => /^[cd][123]$/.test(id)).length).toBe(3);
    }
  });

  it("lets cluster members flow as individuals in adaptive practice", () => {
    const qs = Core.assembleExam({
      bank: clusterBank(), n: 20, rand: mulberry32(7), caseStudySeats: 3,
    });
    expect(qs.length).toBe(20); // no seats reserved, no adjacency forced
  });

  it("never examines a split cluster when the bank is filtered", () => {
    const bank = clusterBank().filter((x) => x.id !== "c3"); // cluster alpha broken
    const qs = Core.assembleExam({
      bank, n: 20, samplingMode: "representative",
      rand: mulberry32(7), caseStudySeats: 3,
    });
    expect(qs.length).toBe(20);
    const ids = clusterIds(qs);
    // alpha is incomplete so it is skipped; beta is drawn whole and adjacent
    expect(ids).not.toContain("c1");
    expect(ids).not.toContain("c2");
    const beta = ["d1", "d2", "d3"].map((id) => ids.indexOf(id));
    expect(beta.every((i) => i >= 0)).toBe(true);
    const sorted = [...beta].sort((a, b) => a - b);
    expect(sorted[2] - sorted[0]).toBe(2);
  });

  it("draws two whole clusters when six seats are reserved", () => {
    const qs = Core.assembleExam({
      bank: clusterBank(), n: 20, samplingMode: "representative",
      rand: mulberry32(11), caseStudySeats: 6,
    });
    expect(qs.length).toBe(20);
    const ids = clusterIds(qs);
    for (const block of [["c1", "c2", "c3"], ["d1", "d2", "d3"]]) {
      const idx = block.map((id) => ids.indexOf(id));
      expect(idx.every((i) => i >= 0)).toBe(true);
      const sorted = [...idx].sort((a, b) => a - b);
      expect(sorted[2] - sorted[0]).toBe(2);
    }
  });
});

describe("case-study content rules", () => {
  function checkable(questions) {
    const data = loadContent();
    return {
      ...data,
      QUESTIONS: questions.map((x, i) => ({
        id: `t${i}`, cat: "signs", q: `Distinct question ${i} about roundabouts and signals?`,
        choices: ["alpha", "beta", "gamma", "delta"], a: i % 4,
        why: `The correct answer alpha teaches roundabout priority for question ${i}.`,
        ...x,
      })),
    };
  }
  const base = {
    jurisdiction: ["UK"], concept: "roundabout-priority",
    sourceId: "uk-highway-code", sourceSection: "Roundabouts",
  };
  const member = (caseId, stem) => ({ ...base, caseId, caseStem: stem });

  it("rejects clusters with divergent stems", () => {
    const data = checkable([
      member("uk-case-x", `${STEM} Version one.`),
      member("uk-case-x", `${STEM} Version one.`),
      member("uk-case-x", `${STEM} Version two here.`),
    ]);
    const { errors } = runChecks(data);
    expect(errors.some((e) => e.rule === "case-study")).toBe(true);
  });

  it("rejects clusters that are not exactly three questions", () => {
    const data = checkable([
      member("uk-case-x", STEM), member("uk-case-x", STEM),
    ]);
    const { errors } = runChecks(data);
    expect(errors.some((e) => e.rule === "case-study")).toBe(true);
  });

  it("rejects clusters spanning jurisdictions", () => {
    const data = checkable([
      member("uk-case-x", STEM), member("uk-case-x", STEM),
      { ...member("uk-case-x", STEM), jurisdiction: ["CA"] },
    ]);
    // CA is not a registered pack in this fixture shape, so either the
    // case-study rule or the schema jurisdiction rule must fire.
    const { errors } = runChecks(data);
    expect(errors.some((e) => e.rule === "case-study" || e.rule === "schema")).toBe(true);
  });

  it("accepts a well-formed three-question cluster", () => {
    const data = checkable([
      member("uk-case-x", STEM), member("uk-case-x", STEM), member("uk-case-x", STEM),
    ]);
    const { errors } = runChecks(data);
    expect(errors.filter((e) => e.rule === "case-study")).toEqual([]);
  });
});

describe("cluster-aware repair", () => {
  function repairBank() {
    // One cased story (3 concepts) + fresh variants for each concept.
    const bank = [
      q("m1", "signs", { caseId: "t-case-alpha", caseStem: STEM, concept: "alpha-one" }),
      q("m2", "row", { caseId: "t-case-alpha", caseStem: STEM, concept: "alpha-two" }),
      q("m3", "laws", { caseId: "t-case-alpha", caseStem: STEM, concept: "alpha-three" }),
      q("f1", "signs", { concept: "alpha-two" }),
      q("f2", "row", { concept: "alpha-three" }),
      q("f3", "laws", { concept: "alpha-one" }),
      q("u1", "signs", { concept: "unrelated" }),
    ];
    return bank;
  }
  it("pulls sibling-story concepts into the post-mock drill", () => {
    const bank = repairBank();
    const answers = [
      { qid: "m1", right: false },
      { qid: "m2", right: true },
      { qid: "m3", right: true },
      { qid: "u1", right: true },
    ];
    const drill = Coach.postMockDrill({ bank, answers, qstats: {} });
    // Direct miss (alpha-one) plus both siblings (alpha-two, alpha-three).
    expect(drill.conceptKeys).toEqual(expect.arrayContaining(["alpha-one", "alpha-two", "alpha-three"]));
    expect(drill.caseRepairs.length).toBe(1);
    expect(drill.caseRepairs[0].caseId).toBe("t-case-alpha");
    expect(drill.reason).toMatch(/whole story/);
    // Fresh variants preferred over replays.
    expect(drill.questions.map((x) => x.id)).toEqual(expect.arrayContaining(["f1", "f2", "f3"]));
    expect(drill.questions.map((x) => x.id)).not.toContain("m1");
  });
  it("leaves non-case drills untouched", () => {
    const bank = [q("a1", "signs", { concept: "solo" }), q("a2", "signs", { concept: "solo" }), q("b1", "row", { concept: "other" })];
    const drill = Coach.postMockDrill({ bank, answers: [{ qid: "a1", right: false }], qstats: {} });
    expect(drill.caseRepairs).toEqual([]);
    expect(drill.reason).not.toMatch(/whole story/);
  });
  it("summarises missed stories in the debrief", () => {
    const bank = repairBank();
    const answers = [
      { qid: "m1", right: false },
      { qid: "m2", right: false },
      { qid: "m3", right: true },
    ];
    const d = Coach.mockDebrief({ bank, answers, qstats: {} });
    expect(d.caseStudy.length).toBe(1);
    expect(d.caseStudy[0]).toMatchObject({ caseId: "t-case-alpha", missed: 2, total: 3 });
  });
});

describe("GB official simulation (real bank)", () => {
  it("draws 50 with one adjacent case-study triple sharing a stem", () => {
    const data = loadContent();
    const pool = data.STATE_PACKS.UK.questions;
    const bp = data.EXAM_BLUEPRINTS.UK;
    expect(bp.caseStudySeats).toBe(3);
    const qs = Core.assembleExam({
      bank: pool, n: bp.questionCount, samplingMode: "representative",
      weights: bp.topicWeights, rand: mulberry32(20261013), caseStudySeats: bp.caseStudySeats,
    });
    expect(qs.length).toBe(50);
    expect(new Set(qs.map((x) => x.id)).size).toBe(50);
    const cased = qs.map((x, i) => ({ ...x, i })).filter((x) => x.caseId);
    expect(cased.length).toBe(3);
    expect(new Set(cased.map((x) => x.caseId)).size).toBe(1);
    expect(new Set(cased.map((x) => x.caseStem)).size).toBe(1);
    const idx = cased.map((x) => x.i).sort((a, b) => a - b);
    expect(idx[2] - idx[0]).toBe(2);
  });
  it("offers at least six complete three-question stories to vary repeat sims", () => {
    const data = loadContent();
    const pool = data.STATE_PACKS.UK.questions;
    const byCase = new Map();
    for (const q of pool) {
      if (!q.caseId) continue;
      const list = byCase.get(q.caseId) || [];
      list.push(q);
      byCase.set(q.caseId, list);
    }
    expect(byCase.size).toBeGreaterThanOrEqual(7);
    for (const [caseId, members] of byCase.entries()) {
      expect(members.length).toBe(3);
      expect(new Set(members.map((m) => m.caseStem)).size).toBe(1);
      expect(caseId).toMatch(/^uk-case-/);
    }
  });
});

describe("US state-pack depth (real bank)", () => {
  it("California carries enough state-specific questions for a meaningful simulation", () => {
    const data = loadContent();
    const ca = (data.STATE_PACKS.CA.questions || []).filter((q) => (q.jurisdiction || []).includes("CA"));
    expect(ca.length).toBeGreaterThanOrEqual(20);
    for (const q of ca) {
      expect(typeof q.sourceSection === "string" && q.sourceSection.trim().length).toBeTruthy();
      expect(typeof q.concept === "string" && q.concept.trim().length).toBeTruthy();
    }
    const pos = [0, 0, 0, 0];
    for (const q of ca) pos[q.a]++;
    for (const n of pos) expect(n / ca.length).toBeGreaterThanOrEqual(0.15);
  });
  it("Texas carries enough state-specific questions for a meaningful simulation", () => {
    const data = loadContent();
    const tx = (data.STATE_PACKS.TX.questions || []).filter((q) => (q.jurisdiction || []).includes("TX"));
    expect(tx.length).toBeGreaterThanOrEqual(20);
    for (const q of tx) {
      expect(typeof q.sourceSection === "string" && q.sourceSection.trim().length).toBeTruthy();
      expect(typeof q.concept === "string" && q.concept.trim().length).toBeTruthy();
    }
    const pos = [0, 0, 0, 0];
    for (const q of tx) pos[q.a]++;
    for (const n of pos) expect(n / tx.length).toBeGreaterThanOrEqual(0.15);
  });
});

describe("Weakness Centre case-story replay", () => {
  const STORY_STEM = "A shared scenario long enough to pass any schema floor the checks enforce.";
  const storyBank = () => [
    { id: "s1", cat: "signs", q: "Story question one?", choices: ["a", "b", "c"], a: 0, why: "Because one.", caseId: "t-case-gamma", caseStem: STORY_STEM },
    { id: "s2", cat: "signs", q: "Story question two?", choices: ["a", "b", "c"], a: 0, why: "Because two.", caseId: "t-case-gamma", caseStem: STORY_STEM },
    { id: "s3", cat: "signs", q: "Story question three?", choices: ["a", "b", "c"], a: 0, why: "Because three.", caseId: "t-case-gamma", caseStem: STORY_STEM },
    { id: "f1", cat: "row", q: "Filler question?", choices: ["a", "b"], a: 0, why: "Because filler." },
  ];
  it("surfaces a damaged story first with a whole-story replay action", () => {
    const wc = Coach.weaknessCentre({ bank: storyBank(), qstats: { s2: { wrong: 1, attempts: 2 } }, misconceptions: {}, nowMs: Date.now(), snoozed: {} });
    expect(wc.sections[0].id).toBe("case-story");
    const p = wc.sections[0].problems[0];
    expect(p.category).toBe("case-story");
    expect(p.drillIds).toEqual(["s1", "s2", "s3"]);
    expect(p.actions).toContain("drill");
    expect(p.problem).toMatch(/1 of 3/);
  });
  it("stays absent when no story member was missed", () => {
    const wc = Coach.weaknessCentre({ bank: storyBank(), qstats: { s1: { wrong: 0, attempts: 1 } }, misconceptions: {}, nowMs: Date.now(), snoozed: {} });
    expect(wc.sections.map((s) => s.id)).not.toContain("case-story");
  });
});
