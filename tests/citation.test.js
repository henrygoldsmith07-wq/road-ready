/* Citation model: every feedback surface shares Packs.citationForQuestion, so
 * no rendered citation can contain "undefined", invent a section, or link a
 * source that has no URL. Regression net for the practice-feedback bug where
 * universal questions rendered "Official source: … · undefined ↗". */
import { describe, it, expect } from "vitest";
import Packs from "../js/state-packs.js";
import { loadContent } from "../scripts/content-loader.mjs";

const data = loadContent();
const all = data.QUESTIONS;

describe("citationForQuestion", () => {
  it("universal question: Reference basis title, no link, no section", () => {
    const q = all.find((x) => x.id === "sg01");
    expect(q).toBeTruthy();
    const c = Packs.citationForQuestion(q);
    expect(c.label).toBe("Reference basis");
    expect(c.detail).toBe("U.S. state driver handbooks — commonly taught rules");
    expect(c.url).toBe(null);
    expect(c.section).toBe(null);
  });

  it("state question: Official source agency · section with an https link", () => {
    const q = all.find((x) => Array.isArray(x.jurisdiction) && x.jurisdiction.includes("CA") && x.sourceSection);
    expect(q).toBeTruthy();
    const c = Packs.citationForQuestion(q);
    expect(c.label).toBe("Official source");
    expect(c.detail).toBe(`California DMV · ${q.sourceSection}`);
    expect(c.url).toMatch(/^https:\/\//);
  });

  it("unresolvable questions return null (feedback hides, never renders)", () => {
    expect(Packs.citationForQuestion({ id: "u1" })).toBe(null);
    expect(Packs.citationForQuestion({ id: "bogus", sourceId: "no-such-source" })).toBe(null);
    expect(Packs.citationForQuestion(null)).toBe(null);
  });

  it("bank-wide: every citation renders without undefined or dead links", () => {
    const bad = [];
    for (const q of all) {
      const c = Packs.citationForQuestion(q);
      if (!c) { bad.push(`${q.id}: unresolvable`); continue; }
      const text = `${c.label}: ${c.detail}`;
      if (/undefined|NaN|\[object/.test(text)) bad.push(`${q.id}: ${text}`);
      if (c.url != null && !/^https:\/\//.test(c.url)) bad.push(`${q.id}: bad url ${c.url}`);
      if (!c.label || !c.detail) bad.push(`${q.id}: empty label/detail`);
    }
    expect(bad).toEqual([]);
  });
});
