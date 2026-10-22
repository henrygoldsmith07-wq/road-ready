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

describe("short-token matching", () => {
  it("a 3-letter token matches whole words, not substrings (BAC vs backgrounds)", () => {
    const bacBank = [q("b1", { q: "What is the adult BAC limit?", why: "the limit is 0.08 percent" })];
    expect(Core.searchBank(bacBank, "bac").map((r) => r.q.id)).toEqual(["b1"]);
    const bgBank = [q("b2", { q: "What should you check?", why: "check the background traffic before moving" })];
    expect(Core.searchBank(bgBank, "bac")).toEqual([]);
  });

  it("short sign tokens match names/words, not mid-word substrings", () => {
    const lib = {
      town: { name: "Town Centre", family: "Direction", meaning: "White backgrounds with black lettering." },
      bac: { name: "BAC rule sign", family: "Regulatory", meaning: "Reminds of the limit." },
    };
    expect(Core.searchSigns(lib, "bac").map((r) => r.id)).toEqual(["bac"]);
  });

  it("short numeric tokens still match figures (500 ft, 0.08)", () => {
    const numBank = [q("n1", { q: "When do you dim high beams?", why: "dim within 500 ft of oncoming traffic" })];
    expect(Core.searchBank(numBank, "500").map((r) => r.q.id)).toEqual(["n1"]);
  });
});

describe("finder robustness (stemming + typo tolerance)", () => {
  const stemBank = [
    q("b1", { q: "When must you brake before a junction?", why: "braking early keeps control" }),
    q("b2", { q: "Who must yield at a roundabout?", why: "yield to traffic already there" }),
  ];
  it("matches inflected forms: braking -> brake, yielding -> yield, signs -> sign", () => {
    expect(Core.searchBank(stemBank, "braking").map((r) => r.q.id)).toContain("b1");
    expect(Core.searchBank(stemBank, "yielding").map((r) => r.q.id)).toContain("b2");
    expect(Core.searchBank(stemBank, "brakes").map((r) => r.q.id)).toContain("b1");
  });
  it("tolerates one-letter typos for longer tokens", () => {
    expect(Core.searchBank(stemBank, "yeild").map((r) => r.q.id)).toContain("b2");
    expect(Core.searchBank(stemBank, "braek").map((r) => r.q.id)).toContain("b1");
  });
  it("does not let stemming reintroduce short-token junk", () => {
    const junk = q("j1", { q: "How is the business district signed?", why: "backgrounds and signage" });
    expect(Core.searchBank([junk], "bus")).toEqual([]);
    expect(Core.searchBank([junk], "BAC")).toEqual([]);
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
