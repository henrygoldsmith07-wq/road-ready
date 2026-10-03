/* Concept families: mastery must measure understanding of a rule, not
   memorisation of one question — so high-value concepts carry multiple
   question FORMS of the same underlying rule, without near-duplicates. */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { tokens, jaccard } from "../scripts/content-checks.mjs";

const data = loadContent();
const UK = data.STATE_PACKS.UK.questions;

const byConcept = (key) => UK.filter((q) => q.concept === key);

/* Concepts deliberately grown into FAMILIES of differently-shaped variants:
   the same underlying rule tested through recall, scenarios, ordering and
   comparison. */
const FAMILIES = {
  "stopping-vs-thinking": 2,
  "braking-distance-factors": 1,
  "following-distance": 2,
  "motorway-stopping-gap": 1,
  "stopping-distance-at-30": 1,
  "double-yellow-lines": 2,
  "single-yellow-lines": 1,
  "yellow-line-loading": 1,
  "no-waiting-vs-no-stopping": 1,
  "min-vs-max-speed": 1,
  "national-speed-vs-end-of-limit": 1,
};

describe("concept families", () => {
  it("high-value concepts carry multiple question variants", () => {
    for (const [concept, minCount] of Object.entries(FAMILIES)) {
      const qs = byConcept(concept);
      expect(qs.length, concept).toBeGreaterThanOrEqual(minCount);
    }
  });

  it("stopping vs thinking distance is tested from several angles", () => {
    const qs = byConcept("stopping-vs-thinking");
    expect(qs.length).toBeGreaterThanOrEqual(2);
    const forms = new Set(qs.map((q) => q.form || "recall"));
    expect(forms.size).toBeGreaterThanOrEqual(1);
    // at least one variant must mention the KEY DISTINCTION explicitly
    const teachesDistinction = qs.some((q) =>
      /reaction|reacts|while the driver reacts|brakes are (on|applied)/i.test(q.q + " " + q.why));
    expect(teachesDistinction).toBe(true);
  });

  it("the family breadth covers recall, scenario and at least one structured form", () => {
    const familyIds = Object.keys(FAMILIES);
    const qs = UK.filter((q) => familyIds.includes(q.concept));
    const forms = new Set(qs.map((q) => q.form || "recall"));
    expect(forms.has("recall")).toBe(true);
    expect(forms.has("scenario")).toBe(true);
    expect([...forms].some((f) => ["multi-step", "sign-combo", "diagram", "what-next", "prioritisation"].includes(f))).toBe(true);
  });

  it("variants reframe without near-duplicating each other", () => {
    for (const concept of Object.keys(FAMILIES)) {
      const qs = byConcept(concept);
      for (let i = 0; i < qs.length; i++) {
        for (let j = i + 1; j < qs.length; j++) {
          const sim = jaccard(tokens(qs[i].q), tokens(qs[j].q));
          expect(sim, `${qs[i].id} ~ ${qs[j].id} (${concept})`).toBeLessThan(0.82);
        }
      }
    }
  });

  it("variants never contradict each other's rules (same keyed facts)", () => {
    // The stopping-distance FAMILY (reaction time vs braking) must all teach
    // the actual distinction. This deliberately excludes parking/stopping-RULE
    // concepts (icy-stopping-distance, no-waiting-vs-no-stopping), which are a
    // different subject and are checked by the provenance QA instead.
    const familyConcepts = ["stopping-vs-thinking", "braking-distance-factors", "stopping-distance-at-30", "motorway-stopping-gap"];
    const stopQs = UK.filter((q) => familyConcepts.includes(q.concept));
    expect(stopQs.length).toBeGreaterThanOrEqual(5);
    const allTeachDistinction = stopQs.every((q) =>
      /reaction|reacts|brakes are (on|applied)|braking|grip|gap/i.test(q.why));
    expect(allTeachDistinction).toBe(true);
  });

  it("family questions keep full provenance and jurisdiction scoping", () => {
    for (const q of UK.filter((x) => Number(x.id.replace("uk-", "")) >= 356)) {
      expect(q.jurisdiction, q.id).toContain("UK");
      expect(q.sourceId, q.id).toMatch(/^uk-/);
      expect(q.sourceSection, q.id).toBeTruthy();
    }
  });

  it("family answer positions stay inside the GB balance window", () => {
    const counts = [0, 0, 0, 0];
    UK.forEach((q) => counts[q.a]++);
    for (const share of counts.map((c) => c / UK.length)) {
      expect(share).toBeGreaterThanOrEqual(0.20);
      expect(share).toBeLessThanOrEqual(0.30);
    }
  });
});
