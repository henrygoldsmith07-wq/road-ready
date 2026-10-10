/* Rule finder: offline AND-token search over the question bank and sign library. */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

const q = (id, fields) => Object.assign(
  { id, cat: "signs", concept: "generic-rule", q: `Question ${id}?`, choices: ["yes", "no"], a: 0, why: "because the rule says so" },
  fields,
);

const bank = [
  q("r1", { concept: "right-of-way", q: "Who goes first at a 4-way stop?", choices: ["first to arrive", "left car"], why: "arrival order decides" }),
  q("r2", { concept: "speed-limits", q: "What is the speed limit in a school zone?", choices: ["25 mph", "55 mph"], why: "children may be present near the road" }),
  q("r3", { concept: "parking", q: "How far from a fire hydrant may you park?", why: "the hydrant needs clear access for hoses and the stop line matters" }),
];

const signs = {
  stop: { name: "Stop", family: "Regulatory — octagon", meaning: "Come to a complete stop.", alt: { UK: { name: "Stop", meaning: "Give priority at the junction." } } },
  school: { name: "School Zone", family: "Warning — pentagon", meaning: "Slow near schools." },
};

describe("searchBank", () => {
  it("returns nothing for empty, blank or stopword-only queries", () => {
    expect(Core.searchBank(bank, "")).toEqual([]);
    expect(Core.searchBank(bank, "   ")).toEqual([]);
    expect(Core.searchBank(bank, "what is the")).toEqual([]);
  });

  it("requires every token to match somewhere (AND semantics)", () => {
    const one = Core.searchBank(bank, "4-way stop");
    expect(one.map((r) => r.q.id)).toEqual(["r1"]);
    // "hydrant school" matches no single question on both tokens
    expect(Core.searchBank(bank, "hydrant school")).toEqual([]);
  });

  it("ranks a concept hit above an explanation-only hit", () => {
    const res = Core.searchBank(bank, "stop");
    expect(res[0].q.id).toBe("r1"); // question-text hit
    expect(res.map((r) => r.q.id)).toContain("r3"); // why-only hit still found
  });

  it("matches concept keys, choices, sources and ids", () => {
    expect(Core.searchBank(bank, "right of way").map((r) => r.q.id)).toContain("r1");
    expect(Core.searchBank(bank, "55 mph").map((r) => r.q.id)).toContain("r2");
    expect(Core.searchBank(bank, "r3").map((r) => r.q.id)).toContain("r3");
  });

  it("caps results and stays deterministic", () => {
    const big = Array.from({ length: 30 }, (_, i) => q(`s${i}`, { q: "A generic stop rule question?" }));
    const capped = Core.searchBank(big, "stop", { limit: 12 });
    expect(capped).toHaveLength(12);
    const again = Core.searchBank(big, "stop", { limit: 12 });
    expect(again.map((r) => r.q.id)).toEqual(capped.map((r) => r.q.id));
  });

  it("uses the caller's concept labels when provided", () => {
    const withLabel = Core.searchBank(bank, "priority junction", { labelFor: (k) => (k === "right-of-way" ? "Junction priority" : k) });
    expect(withLabel.map((r) => r.q.id)).toContain("r1");
  });

  it("ignores junk entries and non-array banks", () => {
    expect(Core.searchBank(null, "stop")).toEqual([]);
    expect(Core.searchBank([null, "x", 42, ...bank], "hydrant").map((r) => r.q.id)).toEqual(["r3"]);
  });
});

describe("searchSigns", () => {
  it("matches names, families and meanings including jurisdiction alternates", () => {
    expect(Core.searchSigns(signs, "stop").map((r) => r.id)).toContain("stop");
    expect(Core.searchSigns(signs, "pentagon").map((r) => r.id)).toEqual(["school"]);
    expect(Core.searchSigns(signs, "junction").map((r) => r.id)).toEqual(["stop"]); // UK alternate meaning
  });

  it("returns nothing for empty queries or unknown libraries", () => {
    expect(Core.searchSigns(signs, "")).toEqual([]);
    expect(Core.searchSigns(null, "stop")).toEqual([]);
    expect(Core.searchSigns(signs, "roundabout motorway")).toEqual([]);
  });
});
