/* REGRESSION: universality & authority-hierarchy guards (factual QA).
   Guards: universal questions must not assert state-variable numbers;
   nothing may teach that a flagger outranks police officers. */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";
import Packs from "../js/state-packs.js";

const data = loadContent();

describe("universality audit", () => {
  it("shipped universal bank asserts no state-variable numbers", () => {
    const r = runChecks(data);
    expect(r.errors.filter((e) => e.rule === "universality")).toEqual([]);
  });

  it("planted numeric cyclist claim in the universal bank FAILS", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    mutated.QUESTIONS.push({
      id: "zz01", cat: "vulnerable",
      q: "How much clearance when passing a cyclist?",
      choices: ["Give at least 4 feet of clearance", "1 foot", "None", "A mirror's width"],
      a: 0, why: "Four feet of clearance keeps the rider safe from wind pressure.",
    });
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "universality" && /cyclist-passing-distance/.test(e.msg))).toBe(true);
  });

  it("PA learners never see the 3-foot figure; they see their own 4-foot rule", () => {
    const paBank = Packs.filterBankForPack(data.QUESTIONS, "PA");
    const paItem = paBank.find((q) => q.id === "pa-007");
    expect(paItem.choices[paItem.a]).toContain("4 feet");
    // no universal item pairs bikes with a small feet figure
    for (const q of paBank.filter((q) => !q.jurisdiction)) {
      const t = q.q + q.choices.join(" ") + q.why;
      expect(/bicycl|cyclist|bike/i.test(t) && /\b([3-9])\s*(feet|ft)\b/i.test(t), q.id).toBe(false);
    }
  });

  it("CA learners see their own 3-foot rule", () => {
    const ca = data.QUESTIONS.find((q) => q.id === "ca-007");
    expect(ca.choices[ca.a]).toContain("3 feet");
  });
});

describe("authority hierarchy", () => {
  it("shipped flagger content teaches officer precedence, never police subordination", () => {
    const r = runChecks(data);
    expect(r.errors.filter((e) => e.rule === "authority-hierarchy")).toEqual([]);
    const sg21 = data.QUESTIONS.find((q) => q.id === "sg21");
    // the myth survives only as a WRONG distractor
    expect(sg21.choices.some((c) => /(even|including) police directions/i.test(c))).toBe(true);
    expect(/police officer .* outranks even the flagger/i.test(sg21.choices[sg21.a])).toBe(true);
  });

  it("planted 'flagger overrides even police' as correct FAILS", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    const i = mutated.QUESTIONS.findIndex((q) => q.id === "sg21");
    mutated.QUESTIONS[i].choices[mutated.QUESTIONS[i].a] = "Override everything, including police directions";
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "authority-hierarchy" && /outranks police/.test(e.msg))).toBe(true);
  });
});
