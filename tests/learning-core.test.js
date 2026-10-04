/* Learning core: robustness-based concept mastery, mistake taxonomy,
   plain-English coaching, weakness centre, session summary, repair report. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";
import Mastery from "../js/mastery.js";
import Explain from "../js/explain.js";
import Coach from "../js/coach.js";

const NOW = Date.parse("2026-10-02T09:00:00Z");
const DAY = Core.DAY_MS;

const q = (id, concept, form) => ({ id, cat: "signs", concept, form: form || "recall", q: `Q ${id}?`, choices: ["a", "b", "c"], a: 0, why: "because the rule says so and here is why" });

function conceptQs() {
  return [q("c1", "c-one", "recall"), q("c2", "c-one", "scenario"), q("c3", "c-one", "diagram"), q("c4", "c-one", "recall")];
}

describe("concept mastery states (robustness, not repeat answers)", () => {
  it("a never-attempted concept is unseen", () => {
    const r = Mastery.conceptState(conceptQs(), {});
    expect(r.state).toBe("unseen");
    expect(r.display).toBe("Unseen");
  });

  it("one right answer is learning, never secure", () => {
    const r = Mastery.conceptState(conceptQs(), { c1: { seen: 2, correct: 2, wrong: 0 } });
    expect(r.state).toBe("learning");
  });

  it("five near-identical answers on ONE question do not earn strong", () => {
    // Same question repeated: 1 variant, 1 form — transfer credit is missing.
    const r = Mastery.conceptState(conceptQs(), {
      c1: { seen: 6, correct: 6, wrong: 0, lastSeen: NOW - DAY },
    });
    expect(["learning", "secure"]).toContain(r.state);
    expect(r.state).not.toBe("strong");
  });

  it("transfer across question forms and variants earns secure or better", () => {
    const r = Mastery.conceptState(conceptQs(), {
      c1: { seen: 3, correct: 3, wrong: 0, lastSeen: NOW - DAY },
      c2: { seen: 3, correct: 3, wrong: 0, lastSeen: NOW - 2 * DAY },
      c3: { seen: 3, correct: 3, wrong: 0, lastSeen: NOW - 3 * DAY },
    });
    // This evidence is deliberately good (3 forms, 3 variants, 3 retrieval
    // days) — the point is transfer credit is required at all, so the state
    // must clear "secure"; it may legitimately reach "strong".
    expect(["secure", "strong"]).toContain(r.state);
  });

  it("same evidence with only ONE question form stays below secure", () => {
    const r = Mastery.conceptState(conceptQs(), {
      c1: { seen: 6, correct: 6, wrong: 0, lastSeen: NOW - DAY },
    });
    expect(["seen", "learning"]).toContain(r.state);
  });

  it("strong requires multiple retrieval days, 3 forms, and fluency", () => {
    const day = (n) => NOW - n * DAY;
    const r = Mastery.conceptState(conceptQs(), {
      c1: { seen: 4, correct: 4, wrong: 0, lastSeen: day(1) },
      c2: { seen: 4, correct: 4, wrong: 0, lastSeen: day(2) },
      c3: { seen: 4, correct: 4, wrong: 0, lastSeen: day(3) },
      c4: { seen: 4, correct: 4, wrong: 0, lastSeen: day(1) },
    });
    expect(r.state).toBe("strong");
  });

  it("an active recurring misconception overrides even strong evidence", () => {
    const day = (n) => NOW - n * DAY;
    const r = Mastery.conceptState(conceptQs(), {
      c1: { seen: 4, correct: 4, wrong: 0, lastSeen: day(1) },
      c2: { seen: 4, correct: 4, wrong: 0, lastSeen: day(2) },
      c3: { seen: 4, correct: 4, wrong: 0, lastSeen: day(3) },
      c4: { seen: 4, correct: 4, wrong: 0, lastSeen: day(1) },
    }, { errors: 3, repairedAt: null });
    expect(r.overlay).toBe("misconception");
    expect(r.display).toBe("Recurring misconception");
  });

  it("an overdue spaced review overlays 'needs review'", () => {
    const r = Mastery.conceptState(conceptQs(), {
      c1: { seen: 4, correct: 3, wrong: 1, lastSeen: NOW - 3 * DAY, sched: { due: NOW - 2 * DAY, ef: 2.5, interval: 6, reps: 2 } },
    });
    expect(r.overlay).toBe("needs-review");
    expect(r.display).toBe("Needs review");
  });

  it("slow-but-right evidence blocks strong (fluency is part of mastery)", () => {
    const day = (n) => NOW - n * DAY;
    const r = Mastery.conceptState(conceptQs(), {
      c1: { seen: 4, correct: 4, wrong: 0, slowRight: 3, lastSeen: day(1) },
      c2: { seen: 4, correct: 4, wrong: 0, slowRight: 3, lastSeen: day(2) },
      c3: { seen: 4, correct: 4, wrong: 0, lastSeen: day(3) },
      c4: { seen: 4, correct: 4, wrong: 0, lastSeen: day(1) },
    });
    expect(r.state).not.toBe("strong");
  });

  it("concept map orders most pressing first: misconception, review, weak", () => {
    const bank = [
      q("a1", "mis", "recall"), q("a2", "mis", "scenario"),
      q("b1", "due", "recall"), q("b2", "due", "scenario"),
      q("c1x", "fine", "recall"), q("c2x", "fine", "scenario"), q("c3x", "fine", "diagram"),
    ];
    const rows = Mastery.conceptMap(bank, {
      a1: { seen: 3, correct: 0, wrong: 3 },
      b1: { seen: 3, correct: 3, wrong: 0, sched: { due: NOW - 2 * DAY, ef: 2.5, interval: 6, reps: 2 } },
      c1x: { seen: 3, correct: 3, wrong: 0, lastSeen: NOW - DAY },
      c2x: { seen: 3, correct: 3, wrong: 0, lastSeen: NOW - 2 * DAY },
      c3x: { seen: 3, correct: 3, wrong: 0, lastSeen: NOW - 3 * DAY },
    }, { mis: { errors: 2, repairedAt: null } }, NOW);
    expect(rows[0].key).toBe("mis");
    expect(rows.some((r) => r.key === "due" && r.state === "needs-review")).toBe(true);
  });

  it("mastery statements are plain, not vanity percentages", () => {
    const s = Mastery.masterySummary([
      { state: "unseen" }, { state: "learning" }, { state: "secure" }, { state: "misconception" },
    ]);
    expect(s.statements.join(" ")).toMatch(/untested/);
    expect(s.statements.join(" ")).toMatch(/recurring misconception/);
    expect(s.statements.join(" ")).not.toMatch(/\d+% ready/);
  });
});

describe("mistake taxonomy (hedged, evidence-based)", () => {
  const pct = { p50: 3000, p75: 6000, n: 30 };

  it("a quick wrong answer is 'rushed'", () => {
    const m = Explain.classifyMistake({ q: q("m1", "c-one"), stat: {}, rtMs: 1500, pct, similarIds: [] });
    expect(m.kind).toBe("rushed");
  });

  it("a slow wrong answer on a known concept is 'overthinking'", () => {
    const m = Explain.classifyMistake({
      q: q("m2", "c-one"), stat: { correct: 3, wrong: 1, seen: 4 },
      rtMs: 12000, pct, similarIds: [],
      conceptRow: { state: "secure", baseState: "secure" },
    });
    expect(m.kind).toBe("overthinking");
  });

  it("a sign question with look-alikes is 'visual' confusion", () => {
    const m = Explain.classifyMistake({
      q: { ...q("m3", "c-one"), signId: "noWaiting" }, stat: {}, rtMs: 5000, pct,
      similarIds: ["noStopping"],
    });
    expect(m.kind).toBe("visual");
  });

  it("repeated misses with similar rules present is 'confusion'", () => {
    const m = Explain.classifyMistake({
      q: q("m4", "c-one"), stat: { wrong: 2, seen: 3, correct: 1 }, rtMs: 5000, pct,
      similarIds: ["c2"],
    });
    expect(m.kind).toBe("confusion");
  });

  it("clean prior history suggests a 'lapse'", () => {
    const m = Explain.classifyMistake({
      q: q("m5", "c-one"), stat: { correct: 3, wrong: 1, seen: 4, fastWrong: 0 },
      rtMs: 5000, pct, similarIds: [],
    });
    expect(m.kind).toBe("lapse");
  });

  it("every taxonomy label stays hedged — never a claimed psychological fact", () => {
    for (const t of Object.values(Explain.T)) {
      expect(t.hint.length).toBeGreaterThan(10);
      expect(t.hint).not.toMatch(/you (are|were) (careless|not trying)/i);
    }
  });
});

describe("plain-English coaching copy", () => {
  const cases = [
    ["fix-misconception", /keep getting/i, /confus|blending|compare/i],
    ["review-overdue", /review|overdue/i, /long-term memory/i],
    ["build-coverage", /untested|covered only/i, /cheapest marks/i],
    ["improve-fluency", /slower|more slowly/i, /pressure/i],
    ["strengthen-weak-topic", /weakest measured/i, /specific concepts/i],
    ["take-mock", /mock/i, /measure|how knowledge holds/i],
    ["light-review", /test|cram/i, /calm recall/i],
    ["maintain-strong", /strong/i, /keep.*strong/i],
  ];
  for (const [type, re1, re2] of cases) {
    it(`${type} explains noticed → matters → do → success`, () => {
      const e = Explain.explainRecommendation({ type, questionCount: 8, minutes: 6 }, {
        conceptName: "Roundabout priority", errors: 3, coverage: 0.4, topicName: "Junctions",
      });
      expect(`${e.noticed} ${e.matters}`).toMatch(re1);
      expect(e.matters).toMatch(re2);
      expect(e.doNow.length).toBeGreaterThan(10);
      expect(e.amount).toMatch(/\d+ (questions|min)/);
      expect(e.success.length).toBeGreaterThan(5);
    });
  }

  it("no coaching copy uses analytics jargon", () => {
    for (const [type] of cases) {
      const e = Explain.explainRecommendation({ type, questionCount: 5, minutes: 4 }, {});
      const all = `${e.noticed} ${e.matters} ${e.doNow} ${e.success}`;
      expect(all).not.toMatch(/percentile|cohort|heuristic|p50|p75|calibrat/i);
    }
  });
});

describe("wrong-answer breakdown", () => {
  it("names why the tempting choice looked right and what rule to remember", () => {
    const question = q("w1", "c-one");
    question.choices = ["Thinking distance", "Braking distance", "Stopping distance", "Following distance"];
    const b = Explain.wrongAnswerBreakdown({
      q: question, pickedIdx: 1, mistake: Explain.T.confusion, contrast: null,
    });
    expect(b.correctAnswer).toBe("Thinking distance");
    expect(b.whyCorrect).toContain("because");
    expect(b.whyWrong).toMatch(/tempting|applies elsewhere/i);
    expect(b.ruleToRemember.length).toBeGreaterThan(5);
    expect(b.mistake.kind).toBe("confusion");
  });
});

describe("weakness centre", () => {
  const bank = [
    q("j1", "junction-priority", "recall"), q("j2", "junction-priority", "scenario"),
    q("s1", "sign-shape", "recall"), q("s2", "sign-shape", "scenario"),
    q("u1", "unseen-rule", "recall"), q("u2", "unseen-rule", "scenario"),
  ];
  it("groups problems into the five solvable categories", () => {
    const wc = Coach.weaknessCentre({
      bank,
      qstats: {
        j1: { seen: 4, correct: 1, wrong: 3 },
        j2: { seen: 3, correct: 1, wrong: 2 },
        s1: { seen: 5, correct: 5, wrong: 0, slowRight: 2 },
        s2: { seen: 4, correct: 4, wrong: 0 },
      },
      misconceptions: { "junction-priority": { errors: 3, stage: 2, repairedAt: null } },
      nowMs: NOW,
    });
    const ids = wc.sections.map((s) => s.id);
    expect(ids).toContain("misconception");
    expect(ids).toContain("unseen-high-value");
    const mis = wc.sections.find((s) => s.id === "misconception").problems[0];
    expect(mis.problem).toMatch(/mistakes across \d+ attempts/);
    expect(mis.actions).toEqual(["repair", "drill", "rule", "later"]);
  });

  it("tracks resolved vs recurring misconceptions", () => {
    const wc = Coach.weaknessCentre({
      bank, qstats: { j1: { seen: 3, correct: 0, wrong: 3 } },
      misconceptions: {
        "junction-priority": { errors: 3, repairedAt: null },
        "sign-shape": { errors: 2, repairedAt: NOW - 1000 },
      },
      nowMs: NOW,
    });
    expect(wc.resolvedCount).toBe(1);
    expect(wc.recurringCount).toBe(1);
  });
});

describe("session summary and repair report", () => {
  it("session summary counts strengthened, resolved and still-weak concepts", () => {
    const bank = [q("a1", "c-one"), q("a2", "c-one"), q("b1", "c-two"), q("b2", "c-two")];
    const s = Coach.sessionSummary({
      answers: [
        { qid: "a1", right: true }, { qid: "a2", right: true },
        { qid: "b1", right: false }, { qid: "b2", right: false },
      ],
      misconceptions: { "c-two": { errors: 2, repairedAt: NOW } },
      byId: (id) => bank.find((x) => x.id === id),
      sessionStartedAt: NOW - 1000,
    });
    expect(s.correct).toBe(2);
    expect(s.strengthened).toContain("C one");
    expect(s.resolvedMisconceptions).toContain("C two");
  });

  it("repair report says how many mock weaknesses were repaired", () => {
    const rr = Coach.repairReport(
      ["junction-priority", "sign-shape", "bac-limits"],
      [
        { conceptKey: "junction-priority", right: true },
        { conceptKey: "sign-shape", right: true },
        { conceptKey: "bac-limits", right: false },
      ],
      {}, {}, NOW,
    );
    expect(rr.line).toBe("2 of your 3 mock weaknesses were repaired.");
  });

  it("repair report with nothing to repair stays honest", () => {
    expect(Coach.repairReport([], [], {}, {}, NOW).line).toMatch(/No mock weaknesses/);
  });
});

describe("sign confusion pairs", () => {
  it("records confusion both ways and folds to unordered pairs", () => {
    let s = Core.recordSignConfusion({}, "noWaiting", "noStopping", NOW);
    s = Core.recordSignConfusion(s, "noStopping", "noWaiting", NOW);
    const pairs = Core.signConfusionPairs(s);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].count).toBe(2);
  });
});

describe("hazard phases", () => {
  it("classifies clicks across background/potential/developing/critical", () => {
    expect(Core.hazardPhaseAt(0.5, 3, 5, 1.5)).toBe("background");
    expect(Core.hazardPhaseAt(2.0, 3, 5, 1.5)).toBe("potential");
    expect(Core.hazardPhaseAt(3.5, 3, 5, 1.5)).toBe("developing");
    expect(Core.hazardPhaseAt(5.5, 3, 5, 1.5)).toBe("critical");
  });

  it("distinguishes early anticipation from a false positive", () => {
    const analysis = Core.hazardAnalysis("Cyclist", [2.0, 2.2], 3, 5);
    const t = Core.hazardTiming(analysis, [2.0, 2.2], 3, 5, 1.5);
    expect(t.anticipatory).toBe(true);
    expect(t.falsePositives).toBe(0);
    const fp = Core.hazardAnalysis("Cyclist", [0.5], 3, 5);
    const t2 = Core.hazardTiming(fp, [0.5], 3, 5, 1.5);
    expect(t2.falsePositives).toBe(1);
    expect(t2.anticipatory).toBe(false);
  });

  it("category skill rolls up weakest-first", () => {
    const rows = Core.hazardCategorySkill([
      { scenario: "a", pts: 5, outcome: "window", anticipation: "anticipatory" },
      { scenario: "b", pts: 1, outcome: "late", anticipation: "reactive" },
      { scenario: "c", pts: 1, outcome: "late", anticipation: "reactive" },
    ], (name) => (name === "a" ? "pedestrians" : "concealed"));
    expect(rows[0].category).toBe("concealed");
    expect(rows[0].rate).toBeLessThan(rows[1].rate);
  });
});

describe("evidence-aware coach ranking (cooldowns and escalation)", () => {
  const NOW = Date.parse("2026-10-02T09:00:00Z");

  /** A followed intervention event with a measurable before/after pair. */
  const ev = (intervention, moved, over) => ({
    at: NOW,
    type: "build-coverage",
    followed: true,
    intervention,
    before: { conceptMastery: moved ? 0.4 : 0.5, accuracy: moved ? 0.5 : 0.7 },
    after: { conceptMastery: moved ? 0.55 : 0.5, accuracy: moved ? 0.7 : 0.7 },
    ...over,
  });

  it("an intervention that recently failed to help goes on cooldown", () => {
    const events = [ev("concept-drill", false), ev("concept-drill", false)];
    const state = Coach.cooldownState(events);
    expect(state.cooldown).toContain("concept-drill");
    expect(state.escalate).not.toContain("concept-drill");
  });

  it("a cooldown demotes the recommendation but never removes the plan", () => {
    const events = [ev("concept-drill", false), ev("concept-drill", false)];
    const plan = Coach.recommend({
      bank: [q("c1", "cover", "recall"), q("c2", "cover", "scenario")],
      qstats: {}, misconceptions: {}, exams: [], daily: {},
      today: "2026-10-02", nowMs: NOW, coachEvents: events,
    });
    expect(plan.primary).not.toBeNull();
    expect(plan.cooldowns.cooldown).toContain("concept-drill");
    // the demoted candidate explains WHY it is sequenced later, in plain words
    const cooled = plan.all.find((r) => r.why.some((w) => /not moved this yet/i.test(w)));
    expect(cooled).toBeTruthy();
  });

  it("repeated repair failure escalates to a comparison intervention", () => {
    const events = [
      ev("misconception-repair", false, { misconceptionRecurred: true }),
      ev("misconception-repair", false, { misconceptionRecurred: true }),
      ev("misconception-repair", false, { misconceptionRecurred: true }),
    ];
    const state = Coach.cooldownState(events);
    expect(state.escalate).toContain("misconception-repair");

    const bank = [q("j1", "junction-priority", "recall"), q("j2", "junction-priority", "scenario")];
    const plan = Coach.recommend({
      bank,
      qstats: {
        j1: { seen: 4, correct: 1, wrong: 3 },
        j2: { seen: 3, correct: 0, wrong: 3 },
      },
      misconceptions: {
        "junction-priority": { errors: 3, stage: 3, questionIds: ["j1"], repairedAt: null },
      },
      exams: [], daily: {}, today: "2026-10-02", nowMs: NOW, coachEvents: events,
    });
    expect(plan.primary.type).toBe(Coach.REC_TYPES.FIX_MISCONCEPTION);
    expect(plan.primary.escalated).toBe(true);
    expect(plan.primary.title).toMatch(/Compare the confused rules/i);
    expect(plan.primary.drillKind).toBe("misconception-escalation");
  });

  it("effective interventions are reported, not cooled down", () => {
    const events = [ev("spaced-review", true), ev("spaced-review", true)];
    const state = Coach.cooldownState(events);
    expect(state.cooldown).toEqual([]);
    expect(state.recent.find((r) => r.type === "spaced-review")).toBeTruthy();
  });

  it("ranking stays deterministic for identical event logs", () => {
    const events = [ev("concept-drill", false), ev("concept-drill", false)];
    const input = {
      bank: [q("c1", "cover", "recall"), q("c2", "cover", "scenario")],
      qstats: {}, misconceptions: {}, exams: [], daily: {},
      today: "2026-10-02", nowMs: NOW, coachEvents: events,
    };
    expect(JSON.stringify(Coach.recommend(input))).toBe(JSON.stringify(Coach.recommend(input)));
  });
});
