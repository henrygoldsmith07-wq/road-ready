import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const snap = (over = {}) => Object.assign({
  mode: "exam", label: "Mock Exam", pack: "generic", backTo: "home",
  qids: ["a", "b", "c"], i: 1,
  answers: [{ qid: "a", picked: 0, right: true }],
  timeLeft: 120, savedAt: Date.now(),
}, over);

describe("resume snapshots", () => {
  it("roundtrips a valid snapshot", () => {
    const built = Core.buildResumeSnapshot(snap());
    expect(built).toBeTruthy();
    const r = Core.parseResumeSnapshot(JSON.stringify(built), {
      pack: "generic", nowMs: Date.now(), resolve: () => true,
    });
    expect(r.ok).toBe(true);
    expect(r.snapshot.qids).toEqual(["a", "b", "c"]);
  });

  it("rejects corrupt, stale, pack-mismatch and missing questions", () => {
    expect(Core.parseResumeSnapshot("not-json", {}).ok).toBe(false);
    expect(Core.parseResumeSnapshot({ v: 2 }, {}).ok).toBe(false);
    const old = Core.buildResumeSnapshot(snap({ savedAt: Date.now() - 8 * 86400000 }));
    expect(Core.parseResumeSnapshot(old, { nowMs: Date.now() }).error).toBe("stale");
    const good = Core.buildResumeSnapshot(snap());
    expect(Core.parseResumeSnapshot(good, { pack: "CA", nowMs: Date.now() }).error).toBe("pack-mismatch");
    expect(Core.parseResumeSnapshot(good, { pack: "generic", nowMs: Date.now(), resolve: (id) => id !== "b" }).ok).toBe(false);
  });

  it("rejects out-of-range progress and oversized banks", () => {
    expect(Core.buildResumeSnapshot(snap({ i: 5 }))).toBeNull();
    expect(Core.buildResumeSnapshot(snap({ mode: "sim" }))).toBeNull();
    expect(Core.buildResumeSnapshot(snap({ qids: [] }))).toBeNull();
  });
});
