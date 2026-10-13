/* Case-study clusters (DVSA format fidelity): whole clusters are sampled as one
 * adjacent block in official (representative/fixed) forms, flow as individuals
 * in adaptive practice, and are never examined in part. */
import { describe, expect, it } from "vitest";
import Core from "../js/core.js";
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
});
