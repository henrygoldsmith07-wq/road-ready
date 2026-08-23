/* Jurisdiction-module contract: registry, packs and blueprints must agree */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";

const data = loadContent();

describe("jurisdiction module contract", () => {
  const country = data.JURISDICTIONS[data.ACTIVE_COUNTRY];

  it("active country is registered and declares its regions", () => {
    expect(country).toBeTruthy();
    expect(country.regions.length).toBeGreaterThanOrEqual(6);
    for (const key of ["agencyShort", "examName", "learnerPermit"]) {
      expect(typeof country.terminology[key]).toBe("string");
    }
    expect(typeof country.hazardPerception.includedInExam).toBe("boolean");
  });

  it("registry regions, packs and blueprints agree exactly", () => {
    const jurisdictionalPacks = Object.keys(data.STATE_PACKS).filter((k) => k !== "generic");
    expect(jurisdictionalPacks.sort()).toEqual([...country.regions].sort());
    for (const r of country.regions) expect(data.EXAM_BLUEPRINTS[r], r).toBeTruthy();
  });

  it("unregistered region packs FAIL the build", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    mutated.JURISDICTIONS.us.regions = mutated.JURISDICTIONS.us.regions.filter((r) => r !== "TX");
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "jurisdictions" && /"TX" is not listed/.test(e.msg))).toBe(true);
  });

  it("regions listing nonexistent packs FAIL the build", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    mutated.JURISDICTIONS.us.regions.push("XX");
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "jurisdictions" && /lists "XX" but no region pack exists/.test(e.msg))).toBe(true);
  });

  it("missing terminology FAILS the build", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    delete mutated.JURISDICTIONS.us.terminology.examName;
    const r = runChecks(mutated);
    expect(r.errors.some((e) => e.rule === "jurisdictions" && /terminology\.examName/.test(e.msg))).toBe(true);
  });
});
