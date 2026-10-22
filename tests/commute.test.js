import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const q = (id) => ({ id, q: `Q ${id}?`, choices: ["yes", "no"], a: 0, why: `Because ${id}.` });
const bank = ["a", "b", "c", "d"].map(q);

describe("commute queue", () => {
  it("ranks missed first, then weak, then unseen; deterministic", () => {
    const stats = {
      a: { seen: 3, correct: 0, wrong: 3 },
      b: { seen: 4, correct: 1, wrong: 1 },
      c: { seen: 5, correct: 5, wrong: 0 },
    };
    const first = Core.buildCommuteQueue(bank, stats, 10);
    expect(first[0]).toBe("a");
    expect(first).toContain("d");
    const again = Core.buildCommuteQueue(bank, stats, 10);
    expect(again).toEqual(first);
  });

  it("caps length and ignores junk", () => {
    expect(Core.buildCommuteQueue(bank, {}, 2)).toHaveLength(2);
    expect(Core.buildCommuteQueue(null, {}, 5)).toEqual([]);
    expect(Core.buildCommuteQueue([null, q("x")], {}, 5)).toEqual(["x"]);
  });

  it("builds a speakable line", () => {
    expect(Core.commuteLine(q("a"))).toContain("Answer: yes.");
    expect(Core.commuteLine(null)).toBe("");
  });
});
