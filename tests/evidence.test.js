/* Learning-evidence module: honest local measurement of whether RoadReady
   improves learners — insufficient evidence is the default claim. */
import { describe, it, expect } from "vitest";
import Evidence from "../js/evidence.js";

const NOW = Date.parse("2026-10-02T09:00:00Z");

const ev = (over) => Evidence.recordRecommendation([], {
  type: "build-coverage", followed: true,
  before: { conceptMastery: 0.4 }, during: { accuracy: 0.7 }, after: { conceptMastery: 0.45 },
  ...over,
}, NOW);

describe("recording", () => {
  it("appends a small structured event", () => {
    const list = ev();
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe("build-coverage");
    expect(list[0].followed).toBe(true);
    expect(list[0].before.conceptMastery).toBeCloseTo(0.4);
  });

  it("caps the log so long-term use cannot bloat the save", () => {
    let list = [];
    for (let i = 0; i < 250; i++) list = Evidence.recordRecommendation(list, { type: "x", followed: true }, NOW + i);
    expect(list.length).toBeLessThanOrEqual(200);
  });
});

describe("evaluation honesty", () => {
  it("reports insufficient evidence below the sample threshold", () => {
    const rep = Evidence.evaluate(ev());
    expect(rep.improvement.insufficient).toBe(true);
    expect(rep.improvement.need).toBe(8);
    expect(rep.statements.join(" ")).toMatch(/Not enough/i);
  });

  it("unlocks the improvement measure at the threshold and stays scoped to n", () => {
    let list = [];
    for (let i = 0; i < 8; i++) list = Evidence.recordRecommendation(list, {
      type: "build-coverage", followed: true,
      before: { conceptMastery: 0.4 }, after: { conceptMastery: 0.5 },
    }, NOW + i);
    const rep = Evidence.evaluate(list);
    expect(rep.improvement.n).toBe(8);
    expect(rep.improvement.meanMasteryDelta).toBeCloseTo(0.1);
  });

  it("misconception resolution rate needs its own sample", () => {
    let list = [];
    for (let i = 0; i < 5; i++) list = Evidence.recordRecommendation(list, {
      type: "fix-misconception", followed: true,
      before: { misconceptions: 3 }, after: { misconceptions: i % 2 ? 2 : 3 },
    }, NOW + i);
    const rep = Evidence.evaluate(list);
    expect(rep.misconceptionResolution.rate).toBeCloseTo(0.4);
    expect(rep.misconceptionResolution.n).toBe(5);
  });

  it("compares coach-selected and self-directed practice only with enough data", () => {
    let list = [];
    for (let i = 0; i < 4; i++) list = Evidence.recordRecommendation(list, {
      followed: i % 2 === 0,
      before: { accuracy: 0.5 }, during: { accuracy: 0.6 },
    }, NOW + i);
    const rep = Evidence.evaluate(list);
    expect(rep.coachSelectedLift.insufficient).toBe(true);
    expect(rep.selfDirectedLift.insufficient).toBe(true);
  });

  it("never claims a strategy is superior without paired data", () => {
    const rep = Evidence.evaluate([]);
    expect(rep.statements.join(" ")).not.toMatch(/superior|better than|proven/i);
  });

  it("retention probes report per-day samples", () => {
    const rep = Evidence.evaluate([], {
      nowMs: NOW,
      retentionLog: [
        { askedAt: NOW - 3 * 86400000, right: true },
        { askedAt: NOW - 3 * 86400000, right: true },
        { askedAt: NOW - 3 * 86400000, right: false },
      ],
    });
    expect(rep.retention[3].rate).toBeCloseTo(0.667, 2);
    expect(rep.retention[1].insufficient).toBe(true);
  });
});

describe("evidence data survives the save/load round-trip", () => {
  it("measurement metadata is preserved by the state sanitizer", async () => {
    // REGRESSION: sanitizeState's coachEvents whitelist once dropped every
    // measurement field (intervention, recurrence, prior state…), so every
    // derived measure reported "insufficient evidence" forever. This
    // round-trip test is the integration contract between producers, the
    // evidence engine and the store.
    const Core = (await import("../js/core.js")).default;
    const events = Evidence.recordRecommendation([], {
      type: "fix-misconception",
      intervention: "misconception-repair",
      followed: true,
      misconceptionRecurred: true,
      priorMasteryState: "learning",
      questionForm: "scenario",
      jurisdiction: "UK",
      retentionIntervalDays: 3,
      before: { accuracy: 0.5, conceptMastery: 0.4, misconceptions: 2 },
      after: { accuracy: 0.8, conceptMastery: 0.55, misconceptions: 1 },
    }, NOW);
    const m = Core.migrateState({ coachEvents: events });
    const saved = m.state.coachEvents[0];
    expect(saved.intervention).toBe("misconception-repair");
    expect(saved.misconceptionRecurred).toBe(true);
    expect(saved.priorMasteryState).toBe("learning");
    expect(saved.questionForm).toBe("scenario");
    expect(saved.jurisdiction).toBe("UK");
    expect(saved.retentionIntervalDays).toBe(3);
    expect(saved.before.accuracy).toBe(0.5);
    expect(saved.after.conceptMastery).toBeCloseTo(0.55);
  });

  it("after the round-trip the measures are computable (not stuck at insufficient)", async () => {
    const Core = (await import("../js/core.js")).default;
    let events = [];
    // MIN_PAIRS (8) measured pairs are required before a rate is reported —
    // generate enough to cross the threshold honestly.
    for (let i = 0; i < 8; i++) {
      events = Evidence.recordRecommendation(events, {
        intervention: "misconception-repair", followed: true,
        misconceptionRecurred: i % 2 === 0,
        before: { accuracy: 0.5 }, during: { accuracy: 0.6 }, after: { accuracy: 0.75 },
      }, NOW + i);
    }
    const roundTripped = Core.migrateState({ coachEvents: events }).state.coachEvents;
    const rep = Evidence.evaluate(roundTripped);
    expect(rep.misconceptionRecurrence.insufficient).toBeUndefined();
    expect(rep.misconceptionRecurrence.rate).toBeCloseTo(0.5);
    expect(rep.interventions["misconception-repair"].n).toBe(8);
    // The lift measure requires both accuracies; these pairs have them.
    expect(rep.coachSelectedLift.insufficient).toBeUndefined();
    expect(rep.coachSelectedLift.n).toBe(8);
  });
});

describe("producer/consumer vocabulary wiring", () => {
  it("the coach's intervention mapping matches the canonical core vocabulary", async () => {
    // REGRESSION: the app recorded recommendation types ("fix-misconception")
    // while the ranking looked up intervention names ("misconception-repair"),
    // so cooldowns and escalation never fired in production.
    const Core = (await import("../js/core.js")).default;
    const Coach = (await import("../js/coach.js")).default;
    expect(Core.INTERVENTIONS).toContain("misconception-repair");
    for (const type of ["fix-misconception", "review-overdue", "improve-fluency", "build-coverage", "strengthen-weak-topic", "take-mock", "light-review", "maintain-strong"]) {
      const key = Core.interventionFor(type, false);
      expect(Core.INTERVENTIONS, `${type} maps to ${key}`).toContain(key);
    }
    // escalation is a distinct, measurable intervention
    expect(Core.interventionFor("fix-misconception", true)).toBe("misconception-escalation");
    // and the coach's cooldown analysis keys on that same vocabulary
    const events = [1, 2, 3].map(() => ({
      intervention: Core.interventionFor("fix-misconception", false),
      type: "fix-misconception", followed: true, misconceptionRecurred: true,
      before: { conceptMastery: 0.5 }, after: { conceptMastery: 0.5 },
    }));
    expect(Coach.cooldownState(events).escalate).toContain("misconception-repair");
  });

  it("an escalated repair maps to the escalation intervention so its effect is measured separately", async () => {
    const Core = (await import("../js/core.js")).default;
    expect(Core.interventionFor("fix-misconception", true)).toBe("misconception-escalation");
    expect(Core.interventionFor("fix-misconception", false)).toBe("misconception-repair");
  });
});

describe("completion is a real ratio of shown plans", () => {
  it("with no plan-display events, completion reports insufficient rather than 100%", () => {
    const rep = Evidence.evaluate([{ type: "x", followed: true, kind: "practice", during: { accuracy: 0.5 }, after: {} }]);
    expect(rep.recommendationCompletion.insufficient).toBe(true);
    expect(rep.recommendationCompletion.rate).toBeUndefined();
  });

  it("shown-but-ignored plans lower the started rate honestly", () => {
    const events = [
      { type: "build-coverage", kind: "plan-display", sessionId: "p1", followed: false },
      { type: "build-coverage", kind: "plan-display", sessionId: "p2", followed: false },
      { type: "build-coverage", kind: "plan-display", sessionId: "p3", followed: false },
      { type: "build-coverage", kind: "practice", sessionId: "p1", followed: true, during: { accuracy: 0.6 }, after: {} },
    ];
    const rep = Evidence.evaluate(events);
    expect(rep.recommendationCompletion.shown).toBe(3);
    expect(rep.recommendationCompletion.startedRate).toBeCloseTo(0.333, 2);
    expect(rep.recommendationCompletion.finishedRate).toBeCloseTo(0.333, 2);
  });
});

describe("lift never fabricates gains from missing baselines", () => {
  it("pairs without a before.accuracy are excluded instead of counted as 0", () => {
    const events = [1, 2, 3, 4, 5].map(() => ({
      type: "concept-drill", intervention: "concept-drill", followed: true,
      before: { conceptMastery: 0.4 }, // no accuracy recorded
      during: { accuracy: 0.8 },
      after: { conceptMastery: 0.42 },
    }));
    const rep = Evidence.evaluate(events);
    // 5 pairs but none carry both accuracies → insufficient, NOT a fake +0.8
    expect(rep.coachSelectedLift.insufficient).toBe(true);
  });

  it("paired accuracies produce a true before→after delta", () => {
    // MIN_PAIRS (8) measured pairs before the rate is reported.
    const events = Array.from({ length: 8 }, () => ({
      type: "concept-drill", intervention: "concept-drill", followed: true,
      before: { accuracy: 0.5 },
      during: { accuracy: 0.6 },
      after: { accuracy: 0.7 },
    }));
    const rep = Evidence.evaluate(events);
    expect(rep.coachSelectedLift.meanAccuracyDelta).toBeCloseTo(0.1);
    expect(rep.coachSelectedLift.n).toBe(8);
  });
});

describe("one session is measured once", () => {
  it("a shared sessionId is preserved for pairing start and finish", async () => {
    const Core = (await import("../js/core.js")).default;
    const events = Evidence.recordRecommendation([], {
      sessionId: "ev-abc-123", type: "concept-drill", intervention: "concept-drill",
      followed: true, before: { accuracy: 0.5 },
    }, NOW);
    const saved = Core.migrateState({ coachEvents: events }).state.coachEvents[0];
    expect(saved.sessionId).toBe("ev-abc-123");
  });
});
