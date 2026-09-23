/* Jurisdiction-module contract: registry, packs and blueprints must agree */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";

const data = loadContent();

describe("jurisdiction module contract", () => {
  const country = data.JURISDICTIONS[data.ACTIVE_COUNTRY];
  const activeCountries = Object.values(data.JURISDICTIONS).filter((c) => c && c.active);

  it("active countries are registered and declare their regions", () => {
    expect(country).toBeTruthy();
    expect(country.regions.length).toBeGreaterThanOrEqual(6);
    for (const c of activeCountries) {
      for (const key of ["agencyShort", "examName", "learnerPermit"]) {
        expect(typeof c.terminology[key]).toBe("string");
      }
      expect(typeof c.hazardPerception.includedInExam).toBe("boolean");
    }
  });

  it("US regions carry the DVSA-style counterpart: UK ships its own region", () => {
    expect(data.JURISDICTIONS.uk).toBeTruthy();
    expect(data.JURISDICTIONS.uk.regions).toEqual(["UK"]);
    expect(data.JURISDICTIONS.uk.terminology.agencyShort).toBe("DVSA");
    expect(data.JURISDICTIONS.uk.hazardPerception.includedInExam).toBe(true);
  });

  it("registry regions, packs and blueprints agree exactly", () => {
    const jurisdictionalPacks = Object.keys(data.STATE_PACKS).filter((k) => k !== "generic");
    const claimed = activeCountries.flatMap((c) => c.regions);
    expect(jurisdictionalPacks.sort()).toEqual([...claimed].sort());
    for (const r of claimed) expect(data.EXAM_BLUEPRINTS[r], r).toBeTruthy();
  });

  it("UK blueprint matches the real DVSA car spec", () => {
    expect(data.EXAM_BLUEPRINTS.UK.questionCount).toBe(50);
    expect(data.EXAM_BLUEPRINTS.UK.minCorrect).toBe(43);
    expect(data.EXAM_BLUEPRINTS.UK.timeLimitMin).toBe(57);
  });

  it("GB pack is full-length, country-scoped, and cites the dedicated DVSA format source", () => {
    const uk = data.STATE_PACKS.UK;
    expect(uk.name).toContain("Great Britain");
    expect(uk.includeUniversal).toBe(false);
    expect(uk.questions).toHaveLength(60);
    expect(uk.questions.every((q) => q.jurisdiction.includes("UK"))).toBe(true);
    expect(data.EXAM_BLUEPRINTS.UK.sourceId).toBe("uk-theory-test-format");
    expect(data.SOURCE_REGISTRY["uk-theory-test-format"].agency).toBe("DVSA");
  });

  it("GB facts preserve the Wales and Scotland regional differences", () => {
    const facts = data.STATE_PACKS.UK.facts;
    expect(facts.speedResidential).toContain("20 mph in Wales");
    expect(facts.speedResidential).toContain("30 mph in England and Scotland");
    expect(facts.bacAdult).toContain("35");
    expect(facts.bacAdult).toContain("22");
  });

  it("GB bank keeps answer positions and topics broadly balanced", () => {
    const questions = data.STATE_PACKS.UK.questions;
    const positions = [0, 1, 2, 3].map((pos) => questions.filter((q) => q.a === pos).length / questions.length);
    for (const share of positions) {
      expect(share).toBeGreaterThanOrEqual(0.20);
      expect(share).toBeLessThanOrEqual(0.30);
    }

    const byTopic = Object.fromEntries(Object.keys(data.CATEGORIES).map((cat) => [
      cat,
      questions.filter((q) => q.cat === cat).length,
    ]));
    for (const count of Object.values(byTopic)) {
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count / questions.length).toBeLessThanOrEqual(0.20);
    }
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

  it("jurisdictionTree joins registry + packs + blueprints into the product map", () => {
    const c = data.JURISDICTIONS[data.ACTIVE_COUNTRY];
    const regions = c.regions.map((rid) => {
      const bp = data.EXAM_BLUEPRINTS[rid];
      const src = data.SOURCE_REGISTRY[bp.sourceId];
      return {
        id: rid,
        name: data.STATE_PACKS[rid].name,
        questionCount: (data.STATE_PACKS[rid].questions || []).length,
        examAuthority: src.agency,
        examQuestions: bp.questionCount,
      };
    });
    expect(regions).toHaveLength(6);
    for (const r of regions) {
      expect(r.questionCount).toBeGreaterThanOrEqual(6);
      expect(r.examAuthority).toBeTruthy();
      expect(r.examQuestions).toBeGreaterThanOrEqual(18);
    }
  });
});
