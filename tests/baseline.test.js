/* Quick-start baseline + pack-depth honesty (pure Core helpers) */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const q = (id, cat) => ({ id, cat, q: "Q?", choices: ["a", "b"], a: 0, why: "why" });

describe("buildBaselineSet", () => {
  it("spreads across topics round-robin, one per category first", () => {
    const bank = [
      q("s1", "signs"), q("s2", "signs"),
      q("r1", "rules"), q("r2", "rules"),
      q("a1", "alcohol"), q("a2", "alcohol"),
    ];
    const set = Core.buildBaselineSet(bank, 3);
    expect(set).toHaveLength(3);
    expect(new Set(set.map((x) => x.cat)).size).toBe(3);
  });

  it("is deterministic regardless of bank order within a topic", () => {
    const bankA = [q("s1", "signs"), q("s2", "signs"), q("r1", "rules")];
    const bankB = [q("s2", "signs"), q("s1", "signs"), q("r1", "rules")];
    // same categories covered either way; within-category order is bank order
    expect(Core.buildBaselineSet(bankA, 2).map((x) => x.cat).sort())
      .toEqual(Core.buildBaselineSet(bankB, 2).map((x) => x.cat).sort());
  });

  it("caps at the bank length and handles empty banks", () => {
    const bank = [q("s1", "signs"), q("r1", "rules")];
    expect(Core.buildBaselineSet(bank, 8)).toHaveLength(2);
    expect(Core.buildBaselineSet([], 8)).toEqual([]);
    expect(Core.buildBaselineSet(bank, 0)).toEqual([]);
  });

  it("defaults to 8 when no size is given", () => {
    const bank = [];
    for (let i = 0; i < 20; i++) bank.push(q(`q${i}`, `cat${i % 10}`));
    expect(Core.buildBaselineSet(bank)).toHaveLength(8);
    expect(new Set(Core.buildBaselineSet(bank).map((x) => x.cat)).size).toBe(8);
  });
});

describe("packDepthNotice", () => {
  it("flags thin packs that cannot fill an exam alone", () => {
    const d = Core.packDepthNotice(6, 50);
    expect(d.thin).toBe(true);
    expect(d.short).toContain("6");
    expect(d.detail).toContain("handbook");
  });

  it("clears full packs", () => {
    const d = Core.packDepthNotice(60, 50);
    expect(d.thin).toBe(false);
    expect(d.pct).toBe(1);
  });

  it("handles missing blueprints without claiming anything", () => {
    const d = Core.packDepthNotice(6, 0);
    expect(d.thin).toBe(false);
    expect(d.short).toBe("");
  });
});
