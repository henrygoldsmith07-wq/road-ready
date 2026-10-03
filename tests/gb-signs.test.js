/* GB sign/marking expansion — regression coverage for the additions to
   js/signs.js and js/packs/uk.js (ids uk-301..uk-355).

   Asserts: every new sign referenced by UK questions exists and passes the GB
   wording guard; new question ids continue the uk-NNN sequence with full
   provenance; and sign artwork/facts agree with the numeric rules they teach. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { loadContent } from "../scripts/content-loader.mjs";

const data = loadContent();
const uk = data.STATE_PACKS.UK.questions;

/* js/signs.js is a classic script; evaluate it the same way tests/sign-deck.test.js does. */
const signSrc = readFileSync(new URL("../js/signs.js", import.meta.url), "utf8") + "\n;this.__SIGNS = SIGNS;\n";
const ctx = {};
runInNewContext(signSrc, ctx);
const SIGNS = ctx.__SIGNS;

const NEW_QUESTION_IDS = Array.from({ length: 55 }, (_, i) => `uk-${String(301 + i).padStart(3, "0")}`);
const NEW_SIGN_IDS = [
  "noOvertaking", "noWaiting", "noStopping", "speedLimit30", "turnLeftAhead", "miniRoundabout",
  "busLane", "cycleRoute", "crossroadsAhead", "roadNarrowsBoth", "levelCrossingGate",
  "levelCrossingOpen", "levelCrossingWigwag", "stAndrewsCross", "tempRoadWorks",
  "tempEndRoadWorks", "tempRoadClosed", "motorwayDirection", "directionPrimary",
  "directionLocal", "motorwayServices",
];

describe("GB expansion: new question provenance", () => {
  it("every new question id exists exactly once in the GB bank", () => {
    const ids = new Set(uk.map((q) => q.id));
    for (const id of NEW_QUESTION_IDS) expect(ids.has(id), id).toBe(true);
    expect(new Set(NEW_QUESTION_IDS).size).toBe(NEW_QUESTION_IDS.length);
  });

  it("new questions carry sourceId, sourceSection and a kebab-case concept", () => {
    for (const q of uk.filter((x) => NEW_QUESTION_IDS.includes(x.id))) {
      expect(q.sourceId, q.id).toMatch(/^uk-(highway-code|know-your-traffic-signs)$/);
      expect(typeof q.sourceSection, q.id).toBe("string");
      expect(q.sourceSection.trim().length, q.id).toBeGreaterThan(3);
      expect(q.concept, q.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(q.jurisdiction, q.id).toEqual(["UK"]);
    }
  });
});

describe("GB expansion: sign references and wording guard", () => {
  it("every sign referenced by a new question exists in the library", () => {
    for (const q of uk.filter((x) => NEW_QUESTION_IDS.includes(x.id))) {
      for (const sid of q.signIds || (q.signId ? [q.signId] : [])) {
        expect(SIGNS[sid], `${q.id}:${sid}`).toBeTruthy();
      }
    }
  });

  it("every new sign is referenced by at least one UK question", () => {
    const used = new Set(uk.flatMap((q) => q.signIds || (q.signId ? [q.signId] : [])));
    for (const sid of NEW_SIGN_IDS) expect(used.has(sid), sid).toBe(true);
  });

  it("new signs pass the GB wording guard on their GB-visible copy", () => {
    const banned = ["3 feet", "railroad", "crosswalk", "intersection", "pentagon", "orange signs", "doubled", "keep right, and don't brake"];
    for (const id of NEW_SIGN_IDS) {
      const s = SIGNS[id];
      const copy = s.alt && s.alt.UK ? s.alt.UK : s;
      const text = (copy.name + " " + copy.meaning).toLowerCase();
      for (const phrase of banned) expect(text, `${id}: "${phrase}"`).not.toContain(phrase);
    }
  });

  it("new signs render balanced, leak-free SVG in the 0 0 100 100 viewBox", () => {
    for (const id of NEW_SIGN_IDS) {
      const s = SIGNS[id];
      expect(s.svg.trim().length, id).toBeGreaterThan(0);
      const open = (s.svg.match(/<[a-zA-Z]/g) || []).length;
      const close = (s.svg.match(/<\/[a-zA-Z]+>/g) || []).length;
      const selfClosing = (s.svg.match(/\/>/g) || []).length;
      expect(open, id).toBe(close + selfClosing);
      expect(s.svg, id).not.toMatch(/NaN|undefined|\$\{/);
    }
  });

  it("GB temporary sign artwork uses yellow ground, not orange", () => {
    for (const id of ["tempRoadWorks", "tempEndRoadWorks", "tempRoadClosed"]) {
      const s = SIGNS[id];
      expect(s.svg, id).toContain("#f2b800");
      expect(s.svg, id).not.toContain("#f28c1b");
    }
    expect(SIGNS.levelCrossingWigwag.svg).toContain("#c1272d");
  });
});

describe("GB expansion: sign-fact agreement on numeric rules", () => {
  it("the stopping-distance question matches the pack fact table", () => {
    const q = uk.find((x) => x.id === "uk-333");
    const evidence = q.choices[q.a] + " " + q.why;
    expect(evidence).toContain("23 metres");
    expect(data.STATE_PACKS.UK.facts.stoppingAt30).toContain("23 metres");
  });

  it("the cyclist-passing figure stays at the official 1.5 metres", () => {
    const q = uk.find((x) => x.id === "uk-007");
    expect(q.choices[q.a]).toContain("1.5 metres");
    expect(data.STATE_PACKS.UK.facts.bikePassing).toContain("1.5 metres");
  });

  it("new numeric questions agree with the fact table where CONCEPT_FACT_KEYS covers them", () => {
    for (const q of uk.filter((x) => NEW_QUESTION_IDS.includes(x.id) && x.concept === "speed-limits")) {
      const keys = data.CONCEPT_FACT_KEYS[q.concept];
      if (!keys) continue;
      const facts = keys.map((k) => data.STATE_PACKS.UK.facts[k]).filter(Boolean).join(" ");
      const evidence = q.choices[q.a] + " " + q.why;
      const digits = (s) => new Set((s.match(/\d+(?:\.\d+)?/g) || []));
      const shared = [...digits(evidence)].some((n) => digits(facts).has(n));
      expect(shared, q.id).toBe(true);
    }
  });

  it("the drink-drive figures stay consistent across the bank and the fact table", () => {
    const q = uk.find((x) => x.id === "uk-343");
    expect(q.choices[q.a]).toContain("80 milligrammes");
    expect(q.why).toContain("22");
    expect(data.STATE_PACKS.UK.facts.bacAdult).toContain("22");
  });
});
