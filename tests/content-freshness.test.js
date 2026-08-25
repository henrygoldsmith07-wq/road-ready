/* REGRESSION: source verification must stay fresh — stale citations fail CI. */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";

const data = loadContent();
const NOW = Date.parse("2026-08-23T00:00:00Z");
const DAY = 86400000;
const MAX_AGE = data.VERIFICATION_MAX_AGE_DAYS ?? 365;

const withSource = (sourceId, verified) => ({
  ...data,
  SOURCE_REGISTRY: { ...data.SOURCE_REGISTRY, [sourceId]: { ...data.SOURCE_REGISTRY[sourceId], verified } },
});

describe("content-freshness", () => {
  it("all shipped sources are fresh as of today", () => {
    const r = runChecks(data, { nowMs: Date.now() });
    expect(r.errors.filter((e) => e.rule === "provenance-stale")).toEqual([]);
  });

  it("a source exactly at max age still passes; one day later fails", () => {
    const id = "ca-dmv-driver-handbook";
    const edge = withSource(id, new Date(NOW - MAX_AGE * DAY).toISOString().slice(0, 10));
    expect(runChecks(edge, { nowMs: NOW }).errors.some((e) => e.rule === "provenance-stale")).toBe(false);

    const stale = withSource(id, new Date(NOW - (MAX_AGE + 1) * DAY).toISOString().slice(0, 10));
    const r = runChecks(stale, { nowMs: NOW });
    expect(r.errors.some((e) => e.rule === "provenance-stale" && new RegExp(id).test(e.msg))).toBe(true);
  });

  it("malformed and future dates are rejected outright", () => {
    let r = runChecks(withSource("tx-dps-driver-handbook", "spring 2026"), { nowMs: NOW });
    expect(r.errors.some((e) => /YYYY-MM-DD/.test(e.msg))).toBe(true);
    r = runChecks(withSource("tx-dps-driver-handbook", "2099-01-01"), { nowMs: NOW });
    expect(r.errors.some((e) => /impossible verified date/.test(e.msg))).toBe(true);
  });

  it("official exam blueprints inherit the staleness requirement", () => {
    const mutated = JSON.parse(JSON.stringify(data));
    mutated.SOURCE_REGISTRY["ny-dmv-driver-manual"].verified = "2019-06-01";
    const r = runChecks(mutated, { nowMs: NOW });
    expect(r.errors.some((e) => e.rule === "provenance-stale" && /blueprint source/.test(e.msg))).toBe(true);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("the freshness window is configured, not magic", () => {
    expect(typeof data.VERIFICATION_MAX_AGE_DAYS).toBe("number");
    expect(data.VERIFICATION_MAX_AGE_DAYS).toBeGreaterThanOrEqual(90);
  });
});
