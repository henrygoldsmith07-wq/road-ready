/* Practical side: drive log → competencies → combined driving readiness */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-08-23T12:00:00Z");
const session = (over) => Object.assign({
  minutes: 52,
  conditions: ["dry"],
  roadTypes: ["urban", "dual-carriageway"],
  skills: { mirrors: "good", "pull-away-control": "good", "roundabout-entry-lane": "ok", "lane-keeping": "poor" },
  notes: "Solid session, roundabouts need work.",
}, over);

describe("log sessions", () => {
  it("appends validated sessions and drops unknown skills/ratings", () => {
    let log = Core.appendPracticalSession([], session({
      skills: { mirrors: "good", "made-up-skill": "good", "blind-spots": "excellent" },
      conditions: ["dry", "lava"],
    }), NOW);
    expect(log).toHaveLength(1);
    expect(Object.keys(log[0].skills)).toEqual(["mirrors"]);
    expect(log[0].conditions).toEqual(["dry"]);
  });

  it("is pure — input log untouched", () => {
    const before = [];
    Core.appendPracticalSession(before, session(), NOW);
    expect(before).toHaveLength(0);
  });
});

describe("competency aggregation", () => {
  const log = [session()];

  it("rolls skill ratings up into the user's example numbers", () => {
    const scores = Core.competencyScores(log);
    const byId = Object.fromEntries(scores.map((s) => [s.id, s]));
    // mirrors ✓ + pull-away ✓ → Observation & Control at 100% (partial coverage)
    expect(byId["observation"].score).toBe(1);
    expect(byId["control"].score).toBe(1);
    // roundabout entry △ → 50%
    expect(byId["roundabouts"].score).toBe(0.5);
    // lane-keeping ✗ → Lane discipline 0%
    expect(byId["lane-discipline"].score).toBe(0);
    // untouched → null with zero coverage
    expect(byId["parking"].score).toBe(null);
  });

  it("tracks coverage separately from score", () => {
    const byId = Object.fromEntries(Core.competencyScores(log).map((s) => [s.id, s]));
    expect(byId["observation"]).toMatchObject({ coverage: 0.25, skillsPracticed: 1, skillsTotal: 4 });
  });

  it("multiple sessions average into the competency (mean of instances)", () => {
    const log2 = Core.appendPracticalSession(log, session({
      skills: { mirrors: "poor" },
    }), NOW + 86400000);
    const obs = Core.competencyScores(log2).find((c) => c.id === "observation");
    expect(obs.score).toBeCloseTo(0.5); // good(1) then poor(0) → mean 0.5
  });
});

describe("driving readiness & focus", () => {
  it("blends theory + practical equally once practical data exists", () => {
    const log = [session()];
    const r = Core.drivingReadiness(84, log); // theory .84, practical .3125
    expect(r.combined).toBe(58);
    expect(r.practical).toBeCloseTo(0.3125);
  });

  it("returns null combined before any sessions", () => {
    expect(Core.drivingReadiness(84, []).combined).toBe(null);
  });

  it("recommends the weakest scored competency as next lesson focus", () => {
    const focus = Core.nextLessonFocus([session()]);
    expect(focus.id).toBe("lane-discipline");
    expect(focus.score).toBe(0);
  });

  it("with no data, points at an uncovered starting competency", () => {
    const focus = Core.nextLessonFocus([]);
    expect(focus.score).toBe(null);
    expect(focus.reason).toContain("no sessions logged yet");
  });
});

describe("persistence", () => {
  it("sessions survive migration sanitization", () => {
    let s = Core.defaultState();
    s.practical.log = Core.appendPracticalSession(s.practical.log, session(), NOW);
    s.practical.log.push({ garbage: true });
    const m = Core.migrateState(s);
    expect(m.state.practical.log).toHaveLength(1);
    expect(m.state.practical.log[0].minutes).toBe(52);
  });

  it("round-trips through export/import", () => {
    let s = Core.defaultState();
    s.practical.log = Core.appendPracticalSession(s.practical.log, session(), NOW);
    const r = Core.parseImport(Core.exportBundle(s));
    expect(r.ok).toBe(true);
    expect(r.state.practical.log[0].skills.mirrors).toBe("good");
  });

  it("every catalogued competency has unique ids and valid skill lists", () => {
    const all = new Set();
    for (const c of Core.COMPETENCIES) {
      expect(c.skills.length).toBeGreaterThanOrEqual(3);
      for (const sk of c.skills) expect(all.has(sk)).toBe(false);
      c.skills.forEach((sk) => all.add(sk));
    }
  });
});
