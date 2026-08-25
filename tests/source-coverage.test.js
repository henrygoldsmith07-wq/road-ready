/* REGRESSION: every question must resolve to a real, jurisdiction-matched
   official source — provenance as factual QA, not a placeholder string. */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";

const data = loadContent();
const { QUESTIONS, SOURCE_REGISTRY, UNIVERSAL_DEFAULTS } = data;

describe("source-coverage", () => {
  it("every question resolves (explicit sourceId or universal default)", () => {
    for (const q of QUESTIONS) {
      const resolved = q.sourceId
        ? q.sourceId in SOURCE_REGISTRY
        : !!UNIVERSAL_DEFAULTS[q.cat];
      expect(resolved, `${q.id} unresolved`).toBe(true);
    }
  });

  it("no fabricated placeholder sources exist anywhere", () => {
    const raw = JSON.stringify({ registry: SOURCE_REGISTRY, defaults: UNIVERSAL_DEFAULTS });
    expect(raw).not.toContain("general-us-dmv-handbook");
    expect(raw).not.toContain("TODO");
  });

  it("registry entries carry agency, title, verified date and https agency URL (or note)", () => {
    for (const [id, s] of Object.entries(SOURCE_REGISTRY)) {
      expect(s.agency?.length, id).toBeGreaterThan(2);
      expect(s.title?.length, id).toBeGreaterThan(3);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(s.verified || ""), id).toBe(true);
      if (s.url) {
        expect(s.url.startsWith("https://"), id).toBe(true);
        expect(s.url).not.toMatch(/example\.com/);
      } else {
        expect(s.note, `${id} needs url or note`).toBeTruthy();
      }
    }
  });

  it("jurisdiction-tagged questions cite their OWN state's document", () => {
    for (const q of QUESTIONS.filter((q) => q.jurisdiction)) {
      const src = SOURCE_REGISTRY[q.sourceId];
      expect(q.jurisdiction, q.id).toContain(src.jurisdiction);
      // the composite universal source must never be cited for a state-specific rule
      expect(src.jurisdiction === "*" && !q.sourceSection, `${q.id} state rule citing composite`).toBe(false);
    }
  });

  it("universal defaults cite the registered composite", () => {
    const ids = new Set(Object.values(UNIVERSAL_DEFAULTS).map((d) => d.sourceId));
    for (const id of ids) expect(SOURCE_REGISTRY[id]?.jurisdiction, id).toBe("*");
  });

  it("runChecks reports zero provenance errors on the shipped bank", () => {
    const { errors, provenance } = runChecks(data);
    expect(errors.filter((e) => e.rule === "provenance" || e.rule === "source-registry")).toEqual([]);
    expect(provenance.size).toBe(QUESTIONS.length);
  });
});
