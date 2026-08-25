/* REGRESSION: the jurisdiction module contract — packs, blueprints, sources
   and the country registry must agree, or CI fails. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import Packs from "../js/state-packs.js";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";

const data = loadContent();

describe("jurisdiction-filtering", () => {
  const bank = [
    { id: "u1", cat: "signs" },
    { id: "ca1", cat: "laws", jurisdiction: ["CA"] },
    { id: "tx1", cat: "row", jurisdiction: ["TX", "NY"] },
  ];

  it("generic = universal only; region = universal + own tagged items", () => {
    expect(Packs.filterBankForPack(bank, "generic").map((q) => q.id)).toEqual(["u1"]);
    expect(Packs.filterBankForPack(bank, "CA").map((q) => q.id)).toEqual(["u1", "ca1"]);
    expect(Packs.filterBankForPack(bank, "TX").map((q) => q.id)).toEqual(["u1", "tx1"]);
    expect(Packs.filterBankForPack(bank, "NY").map((q) => q.id)).toEqual(["u1", "tx1"]);
    // a state never sees another state's exclusive questions
    expect(Packs.filterBankForPack(bank, "PA")).toHaveLength(1);
  });

  it("the shipped bank grows for every non-generic pack and stays disjoint otherwise", () => {
    const universal = Packs.filterBankForPack(data.QUESTIONS, "generic");
    for (const packId of Object.keys(Packs.STATE_PACKS)) {
      if (packId === "generic") continue;
      const active = Packs.filterBankForPack(data.QUESTIONS, packId);
      expect(active.length, packId).toBeGreaterThan(universal.length);
      // no other state's exclusive questions leak in
      for (const q of active) {
        if (q.jurisdiction) expect(q.jurisdiction).toContain(packId);
      }
    }
  });

  it("registry ↔ packs ↔ blueprints stay in lockstep", () => {
    const regions = data.JURISDICTIONS.us.regions;
    expect(regions.sort()).toEqual(Object.keys(data.STATE_PACKS).filter((k) => k !== "generic").sort());
    for (const r of regions) expect(data.EXAM_BLUEPRINTS[r]).toBeTruthy();
  });

  it("terminology is present for user-facing strings", () => {
    const t = data.JURISDICTIONS.us.terminology;
    expect(t.agencyShort).toBe("DMV");
    expect(t.examName.length).toBeGreaterThan(3);
  });

  it("contract drift FAILS runChecks (both directions)", () => {
    const dropRegion = JSON.parse(JSON.stringify(data));
    dropRegion.STATE_PACKS.CA.questions.push({ id: "ca-999", cat: "laws", jurisdiction: ["CA"], q: "New CA rule?", choices: ["a", "b"], a: 0, why: "Because California." });
    // unregistered NEW region appears only if registry drops CA — simulate by renaming
    const renamed = JSON.parse(JSON.stringify(dropRegion));
    renamed.STATE_PACKS.ZZ = { ...renamed.STATE_PACKS.CA, id: "ZZ" };
    delete renamed.STATE_PACKS.CA;
    const r = runChecks(renamed);
    expect(r.errors.some((e) => e.rule === "jurisdictions")).toBe(true);
    void Core; void Packs;
  });
});
