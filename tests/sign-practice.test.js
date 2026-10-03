/* Sign practice: practice-type question shapes, confusion pairs, distractor
   metadata, and the sign-confusion ledger that drives comparison drills. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import { loadContent } from "../scripts/content-loader.mjs";

const data = loadContent();
const UK = data.STATE_PACKS.UK.questions;
const SIGNS = data.SIGNS;

/* The distractor vocabulary this product recognises. A wrong choice may map
 * to a realistic misconception, and selecting it gives the Coach diagnostic
 * information. Tags are kebab-case and drawn from this list only. */
const DISTRACTOR_TAGS = [
  "stopping-vs-thinking", "yellow-line-confusion", "loading-vs-waiting",
  "min-vs-max-speed", "sign-shape", "uk-vs-us-rule", "speed-assumption",
  "following-gap", "tyre-condition", "normal-weather-in-rain",
  "reversed-priority", "junction-confusion",
];

describe("sign practice question forms", () => {
  it("sign-combo questions display real signs (1-3 per the content contract)", () => {
    const combos = UK.filter((q) => q.form === "sign-combo" && Array.isArray(q.signIds));
    expect(combos.length).toBeGreaterThanOrEqual(3);
    for (const q of combos) {
      expect(q.signIds.length, q.id).toBeGreaterThanOrEqual(1);
      expect(q.signIds.length, q.id).toBeLessThanOrEqual(3);
      for (const id of q.signIds) expect(SIGNS[id], `${q.id}: ${id}`).toBeTruthy();
    }
  });

  it("comparison questions reference two different real signs", () => {
    const comparisons = UK.filter((q) => /differ|confus|difference/i.test(q.q) && Array.isArray(q.signIds));
    expect(comparisons.length).toBeGreaterThanOrEqual(2);
    for (const q of comparisons) {
      const unique = new Set(q.signIds);
      expect(unique.size, q.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("reverse questions ask what a rule is NOT", () => {
    const reverse = UK.filter((q) => /NOT (true|mean|apply)/i.test(q.q));
    expect(reverse.length).toBeGreaterThanOrEqual(1);
  });

  it("meaning→choose-sign questions show candidate signs and describe meanings", () => {
    const meaningFirst = UK.filter((q) =>
      Array.isArray(q.signIds) && q.signIds.length >= 2 && /which (of the displayed )?(sign|description)/i.test(q.q));
    expect(meaningFirst.length).toBeGreaterThanOrEqual(1);
    for (const q of meaningFirst) expect(SIGNS[q.signIds[0]], q.id).toBeTruthy();
  });

  it("new practice questions all carry jurisdiction, concept and provenance", () => {
    for (const q of UK.filter((x) => Number(x.id.replace("uk-", "")) >= 301)) {
      expect(q.jurisdiction, q.id).toContain("UK");
      expect(q.concept, q.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(q.sourceId, q.id).toMatch(/^uk-/);
      expect(q.sourceSection, q.id).toBeTruthy();
      expect(q.why.length, q.id).toBeGreaterThanOrEqual(40);
    }
  });
});

describe("distractor misconception metadata", () => {
  const tagged = UK.filter((q) => q.distractors && Object.keys(q.distractors).length);
  it("realistic-misconception distractors are tagged with the known vocabulary", () => {
    expect(tagged.length).toBeGreaterThanOrEqual(5);
    for (const q of tagged) {
      for (const [idx, tag] of Object.entries(q.distractors)) {
        expect(DISTRACTOR_TAGS, `${q.id}: ${tag}`).toContain(tag);
        expect(Number(idx), q.id).toBeGreaterThanOrEqual(0);
        expect(Number(idx), q.id).toBeLessThan(q.choices.length);
      }
    }
  });

  it("distractor tags never point at the correct answer", () => {
    for (const q of tagged) {
      expect(Object.keys(q.distractors).map(Number), q.id).not.toContain(q.a);
    }
  });
});

describe("sign confusion pairs", () => {
  it("GB confusion pairs exist in the bank as comparison questions", () => {
    const pairs = [
      ["noWaiting", "noStopping"],
      ["speedLimit30", "minimumSpeed30"],
      ["nationalSpeedLimit", "endOfSpeedLimitZone"],
    ];
    for (const [a, b] of pairs) {
      expect(SIGNS[a], a).toBeTruthy();
      expect(SIGNS[b], b).toBeTruthy();
      const hasComparison = UK.some((q) => Array.isArray(q.signIds)
        && q.signIds.includes(a) && q.signIds.includes(b));
      expect(hasComparison, `${a} vs ${b}`).toBe(true);
    }
  });

  it("recordSignConfusion records both directions and signConfusionPairs folds them", () => {
    let s = Core.recordSignConfusion({}, "noWaiting", "noStopping", 1700000000000);
    s = Core.recordSignConfusion(s, "noStopping", "noWaiting", 1700000000001);
    s = Core.recordSignConfusion(s, "noWaiting", "noStopping", 1700000000002);
    const pairs = Core.signConfusionPairs(s);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].count).toBe(3);
    expect([pairs[0].a, pairs[0].b].sort()).toEqual(["noStopping", "noWaiting"]);
  });

  it("confusion state survives migration (confused counters sanitized)", () => {
    const m = Core.migrateState({
      signStudy: {
        noWaiting: { stage: "learning", confused: { noStopping: 2, ghost: 0 } },
      },
    });
    expect(m.state.signStudy.noWaiting.confused.noStopping).toBe(2);
    expect(m.state.signStudy.noWaiting.confused.ghost).toBeUndefined();
  });

  it("self-grading with no confusion never fabricates pairs", () => {
    let s = Core.recordSignConfusion({}, "noWaiting", "noWaiting", 0);
    expect(Core.signConfusionPairs(s)).toHaveLength(0);
  });
});
