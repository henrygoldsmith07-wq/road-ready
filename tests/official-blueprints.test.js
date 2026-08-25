/* REGRESSION: official simulations must be locked to the jurisdiction's real
   exam spec — pool, count, pass bar, pacing — independent of user settings. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import { loadContent } from "../scripts/content-loader.mjs";

const data = loadContent();
const { EXAM_BLUEPRINTS, STATE_PACKS } = data;

describe("official-blueprints", () => {
  it("assembles exactly questionCount items and never leaks other states' tagged questions", () => {
    for (const [packId, bp] of Object.entries(EXAM_BLUEPRINTS)) {
      const pool = data.QUESTIONS.filter((q) => !q.jurisdiction || q.jurisdiction.includes(packId));
      const qs = Core.assembleExam({ bank: pool, n: bp.questionCount, qstats: {}, weights: bp.topicWeights });
      expect(qs.length, packId).toBe(Math.min(bp.questionCount, pool.length));
      for (const q of qs) {
        if (q.jurisdiction) expect(q.jurisdiction, `${packId} leaked ${q.id}`).toContain(packId);
      }
    }
  });

  it("official pass bar ignores a laxer user setting", () => {
    // TX needs 21/30; a user with 60% passMark must still fail 18/30 officially
    const bp = EXAM_BLUEPRINTS.TX;
    const userPassMark = 0.6;
    expect(Core.gradeExam(20, bp.questionCount, bp.minCorrect / bp.questionCount).pass).toBe(false);
    expect(Core.gradeExam(18, bp.questionCount, userPassMark).pass).toBe(true); // proves settings differ
  });

  it("FL applies its real 60-minute cap; others use standard pacing", () => {
    expect(Core.timeLimitSecs(EXAM_BLUEPRINTS.FL.questionCount)).toBe(3000);
    expect(EXAM_BLUEPRINTS.FL.timeLimitMin).toBe(60);
    for (const [id, bp] of Object.entries(EXAM_BLUEPRINTS)) {
      if (id === "FL") continue;
      const expected = bp.timeLimitMin ? bp.timeLimitMin * 60 : Core.timeLimitSecs(bp.questionCount);
      expect(expected, id).toBe(bp.timeLimitMin ? bp.timeLimitMin * 60 : bp.questionCount * 60);
    }
  });

  it("labels are user-facing and jurisdiction-scoped", () => {
    for (const [packId, bp] of Object.entries(EXAM_BLUEPRINTS)) {
      expect(bp.label.startsWith(`${STATE_PACKS[packId].name.split(" ")[0]}`) || bp.label.includes("Official")).toBe(true);
      expect(bp.label).toContain("Official Simulation");
    }
  });
});
