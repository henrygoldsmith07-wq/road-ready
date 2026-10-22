/* Content & Sources — the provenance report.
 *
 * The ledger is only worth having if it cannot lie. These tests pin the
 * properties that make it trustworthy: it only shows sources that actually
 * back a question in the active pack, it never claims an "official document"
 * that is not there, it labels a composite as a composite, and it never
 * presents an app-internal topic label as if it were a heading in a handbook.
 */
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("../js/sources.js", import.meta.url)), "utf8");

function loadReport() {
  const dom = new JSDOM("");
  new Function("window", "module", SRC)(dom.window, undefined);
  return dom.window.RoadReadySources.buildReport;
}

const REGISTRY = {
  "ca-dmv-driver-handbook": {
    jurisdiction: "CA", agency: "California DMV", title: "California Driver's Handbook",
    url: "https://example.org/ca", verified: "2026-08-23", sectionKind: "topic",
  },
  "uk-highway-code": {
    jurisdiction: "UK", agency: "Department for Transport", title: "The Highway Code",
    url: "https://example.org/hc", verified: "2026-09-22", sectionKind: "rule",
  },
  "us-dmv-handbooks-composite": {
    jurisdiction: "*", agency: "Multiple state DMVs (composite)",
    title: "U.S. state driver handbooks — commonly taught rules",
    verified: "2026-08-23", citationLabel: "Reference basis",
    basisNote: "A composite of many states' handbooks.",
  },
};

describe("sources report", () => {
  it("lists only sources that back a question in the active pack", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [{ id: "q1", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" }],
      registry: REGISTRY,
    });
    const ids = report.sources.map((s) => s.id);
    expect(ids).toContain("ca-dmv-driver-handbook");
    expect(ids).not.toContain("uk-highway-code");
    expect(ids).not.toContain("us-dmv-handbooks-composite");
  });

  it("counts the questions each source backs", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [
        { id: "q1", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
        { id: "q2", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
        { id: "q3", sourceId: "ca-dmv-driver-handbook", sourceSection: "Littering" },
      ],
      registry: REGISTRY,
    });
    const ca = report.sources.find((s) => s.id === "ca-dmv-driver-handbook");
    expect(ca.count).toBe(3);
  });

  it("does not claim an official document when the pack has none", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [{ id: "q1", sourceId: "us-dmv-handbooks-composite" }],
      registry: REGISTRY,
    });
    // No "official document" stat, and the lead must not use that phrase.
    const statLabels = report.stats.map((s) => s.label);
    expect(statLabels).not.toContain("official documents");
    expect(report.lead).not.toMatch(/named official document/);
    expect(report.lead).toMatch(/reference basis/);
  });

  it("claims official documents only when they are really there", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [
        { id: "q1", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
        { id: "q2", sourceId: "us-dmv-handbooks-composite" },
      ],
      registry: REGISTRY,
    });
    const statLabels = report.stats.map((s) => s.label);
    expect(statLabels).toContain("official document");
    expect(report.lead).toMatch(/named official document/);
  });

  it("marks a composite as a reference basis, not an official source", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [{ id: "q1", sourceId: "us-dmv-handbooks-composite" }],
      registry: REGISTRY,
    });
    const composite = report.sources.find((s) => s.id === "us-dmv-handbooks-composite");
    expect(composite.isBasis).toBe(true);
    expect(composite.label).toBe("Reference basis");
    expect(composite.basisNote).toBeTruthy();
  });

  it("sorts official documents before the composite", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [
        { id: "q1", sourceId: "us-dmv-handbooks-composite" },
        { id: "q2", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
      ],
      registry: REGISTRY,
    });
    expect(report.sources[0].id).toBe("ca-dmv-driver-handbook");
    expect(report.sources[report.sources.length - 1].isBasis).toBe(true);
  });

  it("labels a U.S. topic list as topics and a UK rule list as rules", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [
        { id: "q1", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
        { id: "q2", sourceId: "uk-highway-code", sourceSection: "Level crossings — Rule 297" },
      ],
      registry: REGISTRY,
    });
    const ca = report.sources.find((s) => s.id === "ca-dmv-driver-handbook");
    const uk = report.sources.find((s) => s.id === "uk-highway-code");
    expect(ca.sectionLabel).toBe("Topics covered");
    expect(uk.sectionLabel).toBe("Rules covered");
  });

  it("lists the most-covered sections first", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [
        { id: "q1", sourceId: "ca-dmv-driver-handbook", sourceSection: "Littering" },
        { id: "q2", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
        { id: "q3", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
      ],
      registry: REGISTRY,
    });
    const ca = report.sources.find((s) => s.id === "ca-dmv-driver-handbook");
    expect(ca.topSections[0]).toBe("Parking");
  });

  it("carries the last-checked date for every source", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [{ id: "q1", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" }],
      registry: REGISTRY,
    });
    const ca = report.sources.find((s) => s.id === "ca-dmv-driver-handbook");
    expect(ca.verified).toBe("2026-08-23");
  });

  it("handles an empty bank without throwing", () => {
    const buildReport = loadReport();
    const report = buildReport({ bank: [], registry: REGISTRY });
    expect(report.questionCount).toBe(0);
    expect(report.sources).toEqual([]);
    expect(report.oldest).toBeNull();
  });

  it("flags a source that has gone past the verification window", () => {
    const buildReport = loadReport();
    const old = { ...REGISTRY["ca-dmv-driver-handbook"], verified: "2001-01-01" };
    const report = buildReport({
      bank: [{ id: "q1", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" }],
      registry: { "ca-dmv-driver-handbook": old },
      maxAgeDays: 365,
    });
    expect(report.stale).toBe(true);
    expect(report.oldest).toBe("2001-01-01");
  });

  it("does not flag a source that is inside the verification window", () => {
    const buildReport = loadReport();
    const report = buildReport({
      bank: [{ id: "q1", sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" }],
      registry: REGISTRY,
      maxAgeDays: 365,
    });
    expect(report.stale).toBe(false);
  });

  it("describes this pack's own sources in the footer", () => {
    const buildReport = loadReport();
    const gb = buildReport({
      bank: [{ id: "q1", sourceId: "uk-highway-code", sourceSection: "Rule 97" }],
      registry: REGISTRY,
    });
    // A Great Britain ledger must not talk about the U.S. composite.
    expect(gb.footer).not.toMatch(/composite/i);
    expect(gb.footer).toMatch(/authority that sets the rule/);

    const us = buildReport({
      bank: [{ id: "q1", sourceId: "us-dmv-handbooks-composite" }],
      registry: REGISTRY,
    });
    expect(us.footer).toMatch(/composite/i);
  });
});
