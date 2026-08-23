/* Provenance-as-factual-QA: every question resolvable, fresh, jurisdiction-
   matched, and numerically consistent with its state's fact table. */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const data = loadContent();
const base = () => runChecks(data);
const errorsOf = (r) => r.errors;
const hasRule = (r, rule, re) => r.errors.some((e) => e.rule === rule && (!re || re.test(e.msg)));

describe("provenance resolution (hard requirement)", () => {
  it("every question resolves to a registered official source", () => {
    const { errors, provenance } = base();
    expect(errors.filter((e) => e.rule === "provenance" || e.rule === "source-registry")).toEqual([]);
    expect(provenance.size).toBe(data.QUESTIONS.length);
  });

  it("every jurisdiction-tagged question cites a source covering its jurisdiction", () => {
    for (const q of data.QUESTIONS.filter((q) => q.jurisdiction)) {
      const src = data.SOURCE_REGISTRY[q.sourceId];
      expect(src, `${q.id} sourceId`).toBeTruthy();
      expect(q.jurisdiction).toContain(src.jurisdiction);
    }
  });

  it("removing a universal default FAILS the build (no silent fallbacks)", () => {
    const mutated = {
      ...data,
      UNIVERSAL_DEFAULTS: Object.fromEntries(
        Object.entries(data.UNIVERSAL_DEFAULTS).filter(([k]) => k !== "alcohol")
      ),
    };
    const r = runChecks(mutated);
    expect(hasRule(r, "provenance", /has no universal default/)).toBe(true);
  });

  it("an unregistered sourceId FAILS the build", () => {
    const qs = data.QUESTIONS.map((q) =>
      q.id === "ca-001" ? { ...q, sourceId: "blog-my-driving-thoughts" } : q
    );
    const r = runChecks({ ...data, QUESTIONS: qs });
    expect(hasRule(r, "source-registry", /unregistered source/)).toBe(true);
  });
});

describe("verification freshness", () => {
  it("all shipped sources are within the max age", () => {
    expect(hasRule(base(), "provenance-stale")).toBe(false);
  });

  it("a stale source FAILS the build", () => {
    const mutated = {
      ...data,
      SOURCE_REGISTRY: {
        ...data.SOURCE_REGISTRY,
        "tx-dps-driver-handbook": { ...data.SOURCE_REGISTRY["tx-dps-driver-handbook"], verified: "2020-01-01" },
      },
    };
    const r = runChecks(mutated, { nowMs: Date.parse("2026-08-23T00:00:00Z") });
    expect(hasRule(r, "provenance-stale", /tx-dps-driver-handbook.*days old/)).toBe(true);
  });

  it("a future verified date is impossible, not silently accepted", () => {
    const mutated = {
      ...data,
      SOURCE_REGISTRY: {
        ...data.SOURCE_REGISTRY,
        "ny-dmv-driver-manual": { ...data.SOURCE_REGISTRY["ny-dmv-driver-manual"], verified: "2099-01-01" },
      },
    };
    const r = runChecks(mutated, { nowMs: Date.parse("2026-08-23T00:00:00Z") });
    expect(hasRule(r, "source-registry", /impossible verified date/)).toBe(true);
  });
});

describe("fact-consistency (state numbers must match the fact table)", () => {
  it("all shipped jurisdiction questions corroborate their pack facts", () => {
    expect(hasRule(base(), "fact-consistency")).toBe(false);
    expect(base().stats.factChecks).toBeGreaterThanOrEqual(30);
  });

  it("a wrong BAC number in answer AND explanation FAILS the build", () => {
    const qs = data.QUESTIONS.map((q) => {
      if (q.id !== "ca-001") return q;
      return {
        ...q,
        choices: q.choices.map((c) => c.replace("0.01%", "0.05%")),
        why: "California enforces notably strict limits for drivers who are not yet of legal drinking age.",
      };
    });
    const r = runChecks({ ...data, QUESTIONS: qs });
    expect(hasRule(r, "fact-consistency", /does not corroborate the CA fact table/)).toBe(true);
  });

  it("word-numbers corroborate digits (four == 4)", () => {
    // ny-006 says "FOUR seconds"; the NY fact table says "4-second rule"
    const q = data.QUESTIONS.find((x) => x.id === "ny-006");
    expect(q.why.toLowerCase()).toContain("four");
    expect(hasRule(base(), "fact-consistency")).toBe(false);
  });

  it("concepts without fact coverage are surfaced for review", () => {
    const mutated = {
      ...data,
      STATE_PACKS: {
        ...data.STATE_PACKS,
        CA: { ...data.STATE_PACKS.CA, facts: Object.fromEntries(Object.entries(data.STATE_PACKS.CA.facts).filter(([k]) => k !== "bacUnder21")) },
      },
    };
    const r = runChecks(mutated);
    expect(r.warnings.some((w) => w.rule === "fact-consistency" && /no CA fact-table entry/.test(w.msg))).toBe(true);
  });
});

describe("manifest carries real provenance snapshots", () => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../content-manifest.json", import.meta.url)), "utf8"));

  it("records structured source snapshots, not placeholder strings", () => {
    expect(manifest.questionCount).toBe(data.QUESTIONS.length);
    for (const [id, entry] of Object.entries(manifest.questions)) {
      expect(entry.source.resolved, id).toBe(true);
      expect(typeof entry.source.authority).toBe("string");
      expect(entry.source.authority.length).toBeGreaterThan(3);
      expect(entry.source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("marks which entries come via universal defaults vs explicit citation", () => {
    const explicit = Object.values(manifest.questions).filter((e) => e.source.defaulted === false);
    const defaulted = Object.values(manifest.questions).filter((e) => e.source.defaulted === true);
    expect(explicit.length).toBe(36);  // jurisdiction packs
    expect(defaulted.length).toBe(186); // universal bank
  });

  it("jurisdiction questions cite their own state's authority in the manifest", () => {
    const ca = manifest.questions["ca-001"].source;
    expect(ca.authority).toContain("California");
    expect(ca.section).toContain("Alcohol");
    expect(ca.jurisdiction).toBe("CA");
  });
});
