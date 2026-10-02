/* Jurisdiction isolation for the sign flashcard deck.
 *
 * The SVG sign library is shared across jurisdictions, but most signs encode one
 * country's rules. The deck must be derived from the ACTIVE bank's questions so a
 * Great Britain learner is never drilled on US-only artwork and vice versa.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import Core from "../js/core.js";
import { loadContent } from "../scripts/content-loader.mjs";

const data = loadContent();

/* js/signs.js is a classic script with no exports (app.js reads the globals), so
 * it is evaluated the same way here. The appended assignment is needed because
 * top-level const in a vm context is lexical, not a property of the global. */
const signSrc = readFileSync(new URL("../js/signs.js", import.meta.url), "utf8") + "\n;this.__SIGNS = SIGNS;\n";
const ctx = {};
runInNewContext(signSrc, ctx);
const SIGNS = ctx.__SIGNS;

describe("sign deck jurisdiction scoping", () => {
  it("loads the shared sign library", () => {
    expect(SIGNS && typeof SIGNS === "object").toBe(true);
    expect(Object.keys(SIGNS).length).toBeGreaterThan(0);
  });

  it("collects signId and signIds from a bank, de-duplicated and sorted", () => {
    const bank = [
      { id: "a", signId: "stop" },
      { id: "b", signIds: ["yield", "stop"] },
      { id: "c" },
      { id: "d", signIds: [] },
    ];
    expect(Core.signIdsInBank(bank)).toEqual(["stop", "yield"]);
  });

  it("returns an empty list rather than throwing on an empty or missing bank", () => {
    expect(Core.signIdsInBank([])).toEqual([]);
    expect(Core.signIdsInBank(null)).toEqual([]);
    expect(Core.signIdsInBank(undefined)).toEqual([]);
  });

  it("only returns signs the artwork library can actually render", () => {
    for (const packId of data.PACK_IDS || []) {
      const p = data.STATE_PACKS[packId];
      if (!p) continue;
      for (const id of Core.signIdsInBank(p.questions)) {
        expect(SIGNS[id], `${packId}:${id}`).toBeTruthy();
      }
    }
  });

  it("shows GB-correct wording for every sign in the GB deck", () => {
    const uk = Core.signIdsInBank(data.STATE_PACKS.UK.questions);
    expect(uk.length).toBeGreaterThan(0);
    expect(uk.length).toBeLessThan(Object.keys(SIGNS).length);
    /* Artwork is shared, so the guard is on the WORDING a GB learner reads. Each
       phrase is US-only rulebook language that would be simply wrong on a GB card. */
    const usOnly = [
      "3 feet",            // GB Highway Code 213 says 1.5 metres
      "railroad",          // GB says level crossing
      "orange signs",      // GB temporary signs are white and red
      "doubled",           // no GB road-work fine doubling
      "crosswalk",         // GB says crossing
      "intersection",      // GB says junction
      "pentagon",          // US school sign shape
      "keep right, and don't brake", // US chevron rule; GB keeps left
    ];
    for (const id of uk) {
      const s = SIGNS[id];
      const copy = s.alt && s.alt.UK ? s.alt.UK : s;
      const text = (copy.name + " " + copy.meaning).toLowerCase();
      for (const phrase of usOnly) expect(text, `${id}: "${phrase}"`).not.toContain(phrase);
    }
  });

  it("excludes signs that encode rules a GB test never asks about", () => {
    const uk = Core.signIdsInBank(data.STATE_PACKS.UK.questions);
    const usRulebookOnly = ["noPassingZone", "deerCrossing", "dividedHighwayBegins", "flagger"];
    for (const id of usRulebookOnly) expect(uk, id).not.toContain(id);
  });
});
