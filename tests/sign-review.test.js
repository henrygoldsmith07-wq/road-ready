/* Spaced sign review: five honest card states instead of a known/not-known bit. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const NOW = Date.parse("2026-10-02T09:00:00Z");
const DAY = Core.DAY_MS;

describe("sign stages", () => {
  it("a never-studied card is new", () => {
    expect(Core.signStage(undefined, NOW)).toBe("new");
    expect(Core.signStage({}, NOW)).toBe("new");
    expect(Core.signStage({ stage: "new", due: undefined }, NOW)).toBe("new");
  });

  it("a learned card inside its interval keeps its stage; at the date it is due", () => {
    const learning = { stage: "learning", due: NOW + DAY };
    expect(Core.signStage(learning, NOW)).toBe("learning");
    expect(Core.signStage(learning, NOW + DAY)).toBe("due");
    const mastered = { stage: "mastered", due: NOW + 12 * DAY };
    expect(Core.signStage(mastered, NOW + 11 * DAY)).toBe("mastered");
    expect(Core.signStage(mastered, NOW + 12 * DAY)).toBe("due");
  });
});

describe("reviewSign", () => {
  it("knowing a new card promotes it to learning with a 1-day interval", () => {
    const s = Core.reviewSign(undefined, true, NOW);
    expect(s.stage).toBe("learning");
    expect(s.due).toBe(NOW + 1 * DAY);
    expect(s.reps).toBe(1);
  });

  it("promotion walks new → learning → familiar → mastered and lengthens the interval", () => {
    let s = Core.reviewSign(undefined, true, NOW);            // learning, 1 day
    s = Core.reviewSign(s, true, NOW + DAY);                   // familiar, 3 days
    expect(s.stage).toBe("familiar");
    expect(s.due).toBe(NOW + DAY + 3 * DAY);
    s = Core.reviewSign(s, true, NOW + 4 * DAY);               // mastered, 12 days
    expect(s.stage).toBe("mastered");
    expect(s.due).toBe(NOW + 4 * DAY + 12 * DAY);
    // mastered is the ceiling
    s = Core.reviewSign(s, true, NOW + 16 * DAY);
    expect(s.stage).toBe("mastered");
  });

  it("not knowing lapses to learning, counts a lapse, and does not add a rep", () => {
    const familiar = Core.reviewSign(Core.reviewSign(undefined, true, NOW), true, NOW + DAY);
    const s = Core.reviewSign(familiar, false, NOW + 4 * DAY);
    expect(s.stage).toBe("learning");
    expect(s.lapses).toBe(1);
    expect(s.reps).toBe(familiar.reps);
    expect(s.due).toBe(NOW + 4 * DAY + 1 * DAY);
  });

  it("is deterministic: same inputs, same schedule", () => {
    const a = Core.reviewSign({ stage: "familiar", reps: 2, lapses: 0 }, true, NOW);
    const b = Core.reviewSign({ stage: "familiar", reps: 2, lapses: 0 }, true, NOW);
    expect(a).toEqual(b);
  });
});

describe("signStudyOrder and counts", () => {
  it("due and new cards come before mastered ones", () => {
    const ids = ["aa", "bb", "cc", "dd"];
    const study = {
      aa: { stage: "mastered", due: NOW + 12 * DAY },
      bb: { stage: "learning", due: NOW - DAY },  // due
      cc: { stage: "familiar", due: NOW + 3 * DAY },
    };
    const order = Core.signStudyOrder(ids, study, NOW);
    expect(order[0]).toBe("dd"); // new first
    expect(order[1]).toBe("bb"); // due second
    expect(order.indexOf("aa")).toBeGreaterThan(order.indexOf("cc"));
  });

  it("counts cards per effective stage including the due overlay", () => {
    const ids = ["aa", "bb", "cc", "dd", "ee"];
    const study = {
      aa: { stage: "mastered", due: NOW + 12 * DAY },
      bb: { stage: "learning", due: NOW - DAY },
      cc: { stage: "familiar", due: NOW + 3 * DAY },
      dd: { stage: "learning", due: NOW + DAY },
    };
    const counts = Core.signStageCounts(ids, study, NOW);
    expect(counts).toEqual({ new: 1, learning: 1, familiar: 1, mastered: 1, due: 1 });
  });
});

describe("legacy fcKnown upgrade path", () => {
  it("sanitizeState seeds signStudy as mastered from legacy known flags", () => {
    const m = Core.migrateState({
      fcKnown: { stop: true, yield: true },
      settings: {},
    });
    expect(m.state.signStudy.stop.stage).toBe("mastered");
    expect(m.state.signStudy.yield.stage).toBe("mastered");
    expect(m.state.fcKnown.stop).toBe(true);
  });

  it("round-trips sign study state through sanitize without losing stages", () => {
    const s = Core.defaultState();
    s.signStudy.railCrossing = Core.reviewSign(undefined, true, NOW);
    s.misconceptions["junction-priority"] = { errors: 2, questionIds: ["j1"], stage: 2, solvedIds: [], repairedAt: null };
    const m = Core.migrateState(s);
    expect(m.state.signStudy.railCrossing.stage).toBe("learning");
    expect(m.state.misconceptions["junction-priority"].errors).toBe(2);
    expect(m.state.misconceptions["junction-priority"].stage).toBe(2);
  });
});
