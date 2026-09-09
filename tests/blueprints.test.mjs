/* Official exam blueprints — real jurisdiction specs drive the simulation */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";
import Core from "../js/core.js";

const data = loadContent();
const { EXAM_BLUEPRINTS, STATE_PACKS } = data;

describe("blueprint registry", () => {
  it("every non-generic pack has an official blueprint", () => {
    const packs = Object.keys(STATE_PACKS).filter((k) => k !== "generic");
    for (const p of packs) expect(EXAM_BLUEPRINTS[p], p).toBeTruthy();
  });

  it("matches the real published exam parameters", () => {
    // factual pins — if these change upstream, update deliberately
    expect(EXAM_BLUEPRINTS.CA).toMatchObject({ questionCount: 46, minCorrect: 38 });
    expect(EXAM_BLUEPRINTS.TX).toMatchObject({ questionCount: 30, minCorrect: 21 });
    expect(EXAM_BLUEPRINTS.NY).toMatchObject({ questionCount: 20, minCorrect: 14 });
    expect(EXAM_BLUEPRINTS.FL).toMatchObject({ questionCount: 50, minCorrect: 40, timeLimitMin: 60 });
    expect(EXAM_BLUEPRINTS.WA).toMatchObject({ questionCount: 40, minCorrect: 32 });
    expect(EXAM_BLUEPRINTS.PA).toMatchObject({ questionCount: 18, minCorrect: 15 });
    expect(EXAM_BLUEPRINTS.UK).toMatchObject({ questionCount: 50, minCorrect: 43, timeLimitMin: 57 });
  });

  it("cites a registered source whose jurisdiction matches", () => {
    for (const [packId, bp] of Object.entries(EXAM_BLUEPRINTS)) {
      const src = data.SOURCE_REGISTRY[bp.sourceId];
      expect(src, `${packId} sourceId`).toBeTruthy();
      expect(src.jurisdiction).toBe(packId);
      expect(bp.label).toMatch(/-format simulation$/);
    }
  });

  it("validator enforces blueprints (missing one fails)", () => {
    const mutated = { ...data, EXAM_BLUEPRINTS: Object.fromEntries(Object.entries(EXAM_BLUEPRINTS).filter(([k]) => k !== "NY")) };
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "blueprint" && /"NY" has no exam blueprint/.test(e.msg))).toBe(true);
  });

  it("validator rejects impossible pass bars", () => {
    const mutated = { ...data, EXAM_BLUEPRINTS: { ...EXAM_BLUEPRINTS, NY: { ...EXAM_BLUEPRINTS.NY, minCorrect: 25 } } };
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "blueprint" && /NY.*minCorrect/.test(e.msg))).toBe(true);
  });

  it("validator rejects stale blueprint sources", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    mutated.SOURCE_REGISTRY["ny-dmv-driver-manual"].verified = "2020-01-01";
    const r = runChecks(mutated, { nowMs: Date.parse("2026-08-23T00:00:00Z") });
    expect(r.errors.some((e) => e.rule === "provenance-stale" && /blueprint source/.test(e.msg))).toBe(true);
  });
});

describe("official simulation engine", () => {
  it("assembles exactly questionCount questions from the jurisdiction pool", () => {
    // CA-compatible pool = universal + CA-tagged
    const pool = data.QUESTIONS.filter((q) => !q.jurisdiction || q.jurisdiction.includes("CA"));
    const qs = Core.assembleExam({ bank: pool, n: EXAM_BLUEPRINTS.CA.questionCount, qstats: {}, weights: EXAM_BLUEPRINTS.CA.topicWeights });
    expect(qs.length).toBe(46);
    expect(new Set(qs.map((q) => q.id)).size).toBe(46);
  });

  it("topicWeights skew the mix toward emphasized topics", () => {
    const bank = [];
    ["signs", "vehicle"].forEach((cat) => { for (let i = 0; i < 30; i++) bank.push({ id: `${cat}${i}`, cat }); });
    const flat = Core.assembleExam({ bank, n: 20, qstats: {} });
    const signsFlat = flat.filter((q) => q.cat === "signs").length;
    const weighted = Core.assembleExam({ bank, n: 20, qstats: {}, weights: { signs: 9, vehicle: 1 } });
    const signsWeighted = weighted.filter((q) => q.cat === "signs").length;
    expect(signsWeighted).toBeGreaterThan(signsFlat + 4);
  });

  it("grades on the official bar, not user settings", () => {
    const bp = EXAM_BLUEPRINTS.TX; // 21/30 = 70%
    expect(Core.gradeExam(21, bp.questionCount, bp.minCorrect / bp.questionCount).pass).toBe(true);
    expect(Core.gradeExam(20, bp.questionCount, bp.minCorrect / bp.questionCount).pass).toBe(false);
  });
});
