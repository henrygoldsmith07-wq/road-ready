/* REGRESSION: calibration data consumption must be jurisdiction- and
   engine-version-safe, and official outcomes must attach to the CORRECT
   frozen prediction — never "whichever unresolved one comes first". */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Core from "../js/core.js";

const NOW = Date.parse("2026-09-01T09:00:00Z");
const DAY = 86400000;
const bank = Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, cat: "signs" }));

function frozen(over = {}, snap = {}) {
  return Core.freezePrediction([], "p1", "CA", { readinessPct: 70, coveragePct: 60, mockAvgPct: 66, questionsSeen: 40, bank, ...snap }, { nowMs: NOW, ...over });
}

describe("calibration curve consumption is jurisdiction- and engine-safe", () => {
  it("builds the curve with an engineVersion that excludes other engines", () => {
    const samples = [
      { readinessPct: 85, result: "pass", jurisdiction: "CA", engineVersion: Core.MASTERY_VERSION },
      { readinessPct: 85, result: "fail", jurisdiction: "CA", engineVersion: "mastery-v2-OLD" },
      { readinessPct: 85, result: "fail", jurisdiction: "CA", engineVersion: "mastery-v2-OLD" },
    ];
    const safe = Core.calibrationCurve(samples, { jurisdiction: "CA", engineVersion: Core.MASTERY_VERSION });
    const row = safe.buckets.find((b) => b.bucket === "80–89%");
    expect(row.n).toBe(1); // old-engine samples never mix in
    // n=1 is far below the publication threshold: no rate is quoted.
    expect(row.passRate).toBe(null);
    expect(row.sufficient).toBe(false);

    // The naive call the UI used to make silently mixes engines:
    const mixed = Core.calibrationCurve(samples);
    expect(mixed.buckets.find((b) => b.bucket === "80–89%").n).toBe(3);
  });

  it("pools only same-jurisdiction outcomes, or labels the fallback explicitly", () => {
    const samples = [
      { readinessPct: 75, result: "pass", jurisdiction: "CA", engineVersion: Core.MASTERY_VERSION },
      { readinessPct: 75, result: "fail", jurisdiction: "NY", engineVersion: Core.MASTERY_VERSION },
    ];
    const curve = Core.calibrationCurve(samples, { jurisdiction: "CA", engineVersion: Core.MASTERY_VERSION });
    expect(curve.scope).toBe("pooled-compatible"); // labelled fallback, never silent mixing
    expect(curve.buckets.find((b) => b.bucket === "70–79%").n).toBe(1);
  });

  it("app.js never calls calibrationCurve without jurisdiction/engine options", () => {
    const src = readFileSync(fileURLToPath(new URL("../js/app.js", import.meta.url)), "utf8");
    for (const call of src.match(/Core\.calibrationCurve\([^)]*\)/g) || []) {
      expect(call, "unscoped calibration call: " + call).toMatch(/buildCalibrationCurve|CALIBRATION_CONTEXT|opts|\)/);
    }
    expect(src).toContain("engineVersion: Core.MASTERY_VERSION");
    expect(src).toContain("jurisdiction: state.settings.statePack");
  });

  it("readinessNarrative stays honest under the scoped call when evidence is thin", () => {
    const samples = [{ readinessPct: 70, result: "pass", jurisdiction: "CA", engineVersion: Core.MASTERY_VERSION }];
    const curve = Core.calibrationCurve(samples, { jurisdiction: "CA", engineVersion: Core.MASTERY_VERSION });
    const n = Core.readinessNarrative({ readinessPct: 72, curve, jurisdiction: "CA", engineVersion: Core.MASTERY_VERSION });
    expect(n.mode).toBe("insufficient");
    expect(n.text).toMatch(/Too few|No official-outcome/i);
    expect(n.text).not.toMatch(/chance of passing/i);
  });
});

describe("resolveAttemptPrediction picks the right attempt", () => {
  it("matches by intended test date first", () => {
    const a = frozen({ nowMs: NOW }, {});
    const b = frozen({ nowMs: NOW + DAY });
    b.intendedTestDate = null;
    const b2 = { ...frozen({ nowMs: NOW + DAY }), intendedTestDate: null };
    const predictions = [a, b2, { ...frozen({ nowMs: NOW + 2 * DAY }), intendedTestDate: "2026-09-10" }];
    expect(Core.resolveAttemptPrediction(predictions, { jurisdiction: "CA", officialTestDate: "2026-09-10" }).id).toBe(predictions[2].id);
    void b;
  });

  it("never attaches an outcome across jurisdictions", () => {
    const ca = frozen({ nowMs: NOW });
    const uk = frozen({ nowMs: NOW + DAY });
    uk.jurisdiction = "UK";
    expect(Core.resolveAttemptPrediction([ca], { jurisdiction: "UK" })).toBe(null);
    expect(Core.resolveAttemptPrediction([uk], { jurisdiction: "CA" })).toBe(null);
    expect(Core.resolveAttemptPrediction([uk], { jurisdiction: "UK" }).id).toBe(uk.id);
  });

  it("with several pending, continues after the last resolved attempt", () => {
    const first = frozen({ nowMs: NOW });
    const second = frozen({ nowMs: NOW + DAY });
    const third = frozen({ nowMs: NOW + 2 * DAY });
    const predictions = [first, second, third];
    // the first attempt resolves…
    predictions[0] = Core.attachOutcome(first, "fail", "2026-09-01", NOW + DAY);
    // …so the next outcome belongs to the SECOND pending prediction, not the first-unresolved-by-index
    expect(Core.resolveAttemptPrediction(predictions, { jurisdiction: "CA" }).id).toBe(second.id);
    predictions[1] = Core.attachOutcome(second, "fail", "2026-09-05", NOW + 3 * DAY);
    expect(Core.resolveAttemptPrediction(predictions, { jurisdiction: "CA" }).id).toBe(third.id);
  });

  it("falls back to the earliest pending when nothing has resolved yet", () => {
    const a = frozen({ nowMs: NOW });
    const b = frozen({ nowMs: NOW + DAY });
    expect(Core.resolveAttemptPrediction([a, b], { jurisdiction: "CA" }).id).toBe(a.id);
  });

  it("returns null when there is nothing to match", () => {
    expect(Core.resolveAttemptPrediction([], { jurisdiction: "CA" })).toBe(null);
    const resolved = Core.attachOutcome(frozen({ nowMs: NOW }), "pass", null, NOW);
    expect(Core.resolveAttemptPrediction([resolved], { jurisdiction: "CA" })).toBe(null);
  });
});

describe("recordOfficialOutcome lifecycle", () => {
  it("attaches to the matched prediction and appends one retrospective entry", () => {
    const a = frozen({ nowMs: NOW });
    const b = frozen({ nowMs: NOW + DAY });
    const r = Core.recordOfficialOutcome([a, b], [], "pass", { jurisdiction: "CA", officialTestDate: null, nowMs: NOW + 5 * DAY });
    expect(r.attached).not.toBe(null);
    expect(r.attached.id).toBe(a.id);
    expect(r.attached.outcome.result).toBe("pass");
    expect(r.outcomes).toHaveLength(1); // retrospective journal still receives the entry
    expect(r.predictions[0].outcome.result).toBe("pass");
    expect(r.predictions[1].outcome).toBe(null);
  });

  it("records a standalone retrospective entry when no prediction exists", () => {
    const r = Core.recordOfficialOutcome([], [], "fail", { jurisdiction: "CA", nowMs: NOW, snapshot: { progressPct: 55 } });
    expect(r.attached).toBe(null);
    expect(r.outcomes).toHaveLength(1);
    expect(r.outcomes[0].progressPct).toBe(55);
    expect(r.outcomes[0].result).toBe("fail");
    expect(r.outcomes[0].jurisdiction).toBe("CA");
  });

  it("is idempotent for a duplicate result (no rewrite, no second entry)", () => {
    let predictions = [frozen({ nowMs: NOW })];
    const first = Core.recordOfficialOutcome(predictions, [], "pass", { jurisdiction: "CA", nowMs: NOW + DAY });
    predictions = first.predictions;
    const second = Core.recordOfficialOutcome(predictions, first.outcomes, "pass", { jurisdiction: "CA", nowMs: NOW + 2 * 60 * 1000 });
    expect(second.duplicate).toBe(true);
    expect(second.outcomes).toHaveLength(1);
    expect(second.predictions[0].outcome.recordedAt).toBe(predictions[0].outcome.recordedAt);
  });

  it("a conflicting re-entry for the same attempt is a no-op, not a silent rewrite", () => {
    let predictions = [frozen({ nowMs: NOW })];
    const first = Core.recordOfficialOutcome(predictions, [], "pass", { jurisdiction: "CA", nowMs: NOW + DAY });
    predictions = first.predictions;
    const second = Core.recordOfficialOutcome(predictions, first.outcomes, "fail", { jurisdiction: "CA", nowMs: NOW + 2 * 60 * 1000 });
    expect(second.duplicate).toBe(true); // caught by the double-tap guard
    expect(second.attached).not.toBe(null);
    expect(second.predictions[0].outcome.result).toBe("pass"); // frozen outcome unchanged
    expect(second.outcomes).toHaveLength(1); // no phantom journal entry
  });

  it("a genuine correction after the same-day window is recorded", () => {
    let predictions = [frozen({ nowMs: NOW })];
    const first = Core.recordOfficialOutcome(predictions, [], "pass", { jurisdiction: "CA", nowMs: NOW + DAY });
    predictions = first.predictions;
    const correction = Core.recordOfficialOutcome(predictions, first.outcomes, "fail", { jurisdiction: "CA", nowMs: NOW + 3 * DAY });
    expect(correction.duplicate).toBe(false);
    expect(correction.attached).toBe(null);
    expect(correction.outcomes).toHaveLength(2);
    expect(correction.outcomes[1].result).toBe("fail");
  });

  it("multiple pending attempts resolve in sequence, each exactly once", () => {
    let predictions = [frozen({ nowMs: NOW }), frozen({ nowMs: NOW + DAY }), frozen({ nowMs: NOW + 2 * DAY })];
    let outcomes = [];
    let r = Core.recordOfficialOutcome(predictions, outcomes, "fail", { jurisdiction: "CA", officialTestDate: "2026-09-01", nowMs: NOW + 3 * DAY });
    predictions = r.predictions; outcomes = r.outcomes;
    r = Core.recordOfficialOutcome(predictions, outcomes, "pass", { jurisdiction: "CA", officialTestDate: "2026-09-02", nowMs: NOW + 6 * DAY });
    predictions = r.predictions; outcomes = r.outcomes;
    expect(predictions[0].outcome.result).toBe("fail");
    expect(predictions[1].outcome.result).toBe("pass");
    expect(predictions[2].outcome).toBe(null);
    expect(outcomes).toHaveLength(2);
  });
});

describe("predictions state sanitization", () => {
  it("invalid ids, dates and jurisdictions are clamped, not dropped", () => {
    const m = Core.migrateState({ v: 2, predictions: [{ id: "x".repeat(64), jurisdiction: "CA", intendedTestDate: "not-a-date", attemptNumber: 3, predictionCreatedAt: NOW, readinessPct: 71, outcome: { result: "pass" } }] }, {});
    const p = m.state.predictions[0];
    expect(p.id).toHaveLength(32);
    expect(p.intendedTestDate).toBe(null);
    expect(p.attemptNumber).toBe(3);
    expect(p.outcome.result).toBe("pass");
  });

  it("a future payload keeps its predictions and flags the version", () => {
    const m = Core.migrateState({ v: 99, predictions: [{ id: "pred-9", readinessPct: 50 }] }, {});
    expect(m.warnings.some((w) => w.startsWith("future-version-"))).toBe(true);
    expect(m.state.predictions[0].id).toBe("pred-9");
  });
});

describe("outcome rendering cannot execute imported markup", () => {
  it("renderCalibration builds rows with textContent, not innerHTML", () => {
    const src = readFileSync(fileURLToPath(new URL("../js/app.js", import.meta.url)), "utf8");
    const fnStart = src.indexOf("function renderCalibration");
    const fnEnd = src.indexOf("/* ---------------- learner study");
    const body = src.slice(fnStart, fnEnd);
    expect(body).not.toMatch(/\.innerHTML\s*=/);
    expect(body).toContain("textContent");
  });

  it("escapeHTML escapes markup characters, including quotes", async () => {
    const { escapeHTML } = await import("../js/format.js");
    expect(escapeHTML(`<img src=x onerror="alert(1)">'&`)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;");
    expect(escapeHTML(42)).toBe("42");
    expect(escapeHTML(null)).toBe("null");
  });
});
