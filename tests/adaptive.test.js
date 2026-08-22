/* Adaptive selection & missed-question resurfacing (incl. weak-topic scheduling) */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const q = (id) => ({ id, cat: "signs", q: "Q?", choices: ["a", "b"], a: 0, why: "why" });
const NOW = 1_700_000_000_000;
const DAY = Core.DAY_MS;

describe("adaptive weights", () => {
  it("unseen questions outweigh mastered ones", () => {
    const unseen = Core.adaptiveWeights(q("x1"), undefined, {}, NOW);
    const mastered = Core.adaptiveWeights(q("x2"), { seen: 6, correct: 6, wrong: 0 }, {}, NOW);
    expect(unseen).toBeGreaterThan(mastered);
  });

  it("missed questions surface more than clean ones", () => {
    const missed = Core.adaptiveWeights(q("y1"), { seen: 4, correct: 1, wrong: 3 }, {}, NOW);
    const fine = Core.adaptiveWeights(q("y2"), { seen: 4, correct: 4, wrong: 0 }, {}, NOW);
    expect(missed).toBeGreaterThan(fine);
  });

  it("flagged questions get boosted", () => {
    // baseline chosen below the mastery cap so the weight isn't clamped
    const stat = { seen: 4, correct: 2, wrong: 2 };
    const base = Core.adaptiveWeights(q("z"), stat, {}, NOW);
    const flagged = Core.adaptiveWeights(q("z"), stat, { z: true }, NOW);
    expect(flagged).toBeCloseTo(base + 1.5);
  });

  it("scheduled-due questions get boosted", () => {
    const base = Core.adaptiveWeights(q("d"), { seen: 4, correct: 4, wrong: 0 }, {}, NOW);
    const dueNow = Core.adaptiveWeights(q("d"), { seen: 4, correct: 4, wrong: 0, sched: { due: NOW - DAY / 2, ef: 2.5, interval: 6, reps: 2 } }, {}, NOW);
    const overdue = Core.adaptiveWeights(q("d"), { seen: 4, correct: 4, wrong: 0, sched: { due: NOW - 3 * DAY, ef: 2.5, interval: 6, reps: 2 } }, {}, NOW);
    const future = Core.adaptiveWeights(q("d"), { seen: 4, correct: 4, wrong: 0, sched: { due: NOW + 5 * DAY, ef: 2.5, interval: 6, reps: 2 } }, {}, NOW);
    expect(dueNow).toBeGreaterThan(base);
    expect(overdue).toBeGreaterThan(dueNow);
    expect(future).toBeCloseTo(base);
  });
});

describe("weighted picking", () => {
  it("never returns more than requested or duplicates", () => {
    const pool = ["a", "b", "c"].map((id) => ({ q: q(id), w: 1 }));
    const out = Core.pickWeighted(pool, 10);
    expect(out.length).toBe(3);
    expect(new Set(out.map((x) => x.id)).size).toBe(3);
  });

  it("respects weights deterministically with an injected RNG", () => {
    // rng mid-range → the wheel lands in the heavy item's slice
    const pool = [
      { q: q("low"), w: 0.15 },
      { q: q("high"), w: 9 },
    ];
    const out = Core.pickWeighted(pool, 1, () => 0.5);
    expect(out[0].id).toBe("high");
  });
});

describe("missed-question resurfacing", () => {
  it("returns only previously-missed questions, worst-first", () => {
    const qs = [q("m1"), q("m2"), q("ok")];
    const stats = {
      m1: { seen: 5, correct: 1, wrong: 4 },
      m2: { seen: 5, correct: 3, wrong: 2 },
      ok: { seen: 5, correct: 5, wrong: 0 },
    };
    const out = Core.missedQuestions(qs, stats);
    expect(out.map((x) => x.id)).toEqual(["m1", "m2"]);
  });

  it("ties break by most recent miss", () => {
    const qs = [q("old"), q("new")];
    const stats = {
      old: { seen: 2, correct: 0, wrong: 2, lastWrong: 100 },
      new: { seen: 2, correct: 0, wrong: 2, lastWrong: 900 },
    };
    expect(Core.missedQuestions(qs, stats)[0].id).toBe("new");
  });
});

describe("weak-topic scheduling (SM-2-lite)", () => {
  it("first success schedules tomorrow", () => {
    const s = Core.reviewSched(undefined, true, NOW);
    expect(s.reps).toBe(1);
    expect(s.interval).toBe(1);
    expect(s.due).toBe(NOW + DAY);
  });

  it("second success jumps to ~6 days", () => {
    const s1 = Core.reviewSched(undefined, true, NOW);
    const s2 = Core.reviewSched(s1, true, NOW);
    expect(s2.interval).toBe(6);
  });

  it("intervals grow multiplicatively after that", () => {
    let s = Core.reviewSched(undefined, true, NOW);
    s = Core.reviewSched(s, true, NOW);       // reps=2, interval=6
    s = Core.reviewSched(s, true, NOW);       // reps=3, interval≈6*ef
    expect(s.interval).toBeGreaterThanOrEqual(12);
  });

  it("a lapse resets the streak and resurfaces immediately", () => {
    let s = Core.reviewSched(undefined, true, NOW);
    s = Core.reviewSched(s, true, NOW);
    const failed = Core.reviewSched(s, false, NOW);
    expect(failed.reps).toBe(0);
    expect(failed.interval).toBe(0);
    expect(failed.due).toBe(NOW);             // due right away
    expect(failed.ef).toBeLessThan(s.ef);     // ease factor drops
  });

  it("ease factor stays clamped in [1.3, 2.8]", () => {
    let s = Core.reviewSched(undefined, false, NOW);
    for (let i = 0; i < 20; i++) s = Core.reviewSched(s, false, NOW + i * DAY);
    expect(s.ef).toBeGreaterThanOrEqual(1.3);
    let t = undefined;
    for (let i = 0; i < 30; i++) t = Core.reviewSched(t, true, NOW + i * DAY, 5);
    expect(t.ef).toBeLessThanOrEqual(2.8);
  });

  it("schedDue classifies now/overdue/future/null", () => {
    expect(Core.schedDue({ sched: { due: NOW } }, NOW)).toBe("now");
    expect(Core.schedDue({ sched: { due: NOW - 2 * DAY } }, NOW)).toBe("overdue");
    expect(Core.schedDue({ sched: { due: NOW + DAY } }, NOW)).toBe("future");
    expect(Core.schedDue({}, NOW)).toBe(null);
  });
});
