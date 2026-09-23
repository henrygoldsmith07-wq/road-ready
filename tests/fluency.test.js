/* Answer fluency: response-time evidence on top of right/wrong */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

/**
 * A spread response-time window: 40 samples from 500ms to 10.25s.
 * Median lands at 5500 and the upper quartile at 7750, so "quick",
 * "typical" and "slow" are three distinct bands rather than one value.
 */
const window = () => Array.from({ length: 40 }, (_, i) => 500 + i * 250);

describe("normalizeRt", () => {
  it("rejects a mis-tap and a walked-away answer", () => {
    expect(Core.normalizeRt(50)).toBeNull();
    expect(Core.normalizeRt(Core.MAX_RT_MS + 1)).toBeNull();
  });

  it("rejects values that are not finite numbers", () => {
    expect(Core.normalizeRt(NaN)).toBeNull();
    expect(Core.normalizeRt(null)).toBeNull();
    expect(Core.normalizeRt("fast")).toBeNull();
    expect(Core.normalizeRt(Infinity)).toBeNull();
  });

  it("keeps a plausible measurement, rounded", () => {
    expect(Core.normalizeRt(3200.6)).toBe(3201);
    expect(Core.normalizeRt(Core.MIN_RT_MS)).toBe(Core.MIN_RT_MS);
  });
});

describe("pushRtSample", () => {
  it("appends a usable measurement", () => {
    expect(Core.pushRtSample([1000], 2000)).toEqual([1000, 2000]);
  });

  it("drops an unusable one without losing the window", () => {
    expect(Core.pushRtSample([1000], 10)).toEqual([1000]);
    expect(Core.pushRtSample([1000], null)).toEqual([1000]);
  });

  it("caps the rolling window and keeps the newest", () => {
    const many = Array.from({ length: Core.MAX_RT_SAMPLES + 50 }, (_, i) => 1000 + i);
    const out = Core.pushRtSample(many, 9999);
    expect(out).toHaveLength(Core.MAX_RT_SAMPLES);
    expect(out[out.length - 1]).toBe(9999);
  });

  it("copes with a missing window", () => {
    expect(Core.pushRtSample(undefined, 2000)).toEqual([2000]);
  });
});

describe("rtPercentiles", () => {
  it("withholds percentiles below the evidence floor", () => {
    const few = Array.from({ length: Core.MIN_RT_SAMPLES - 1 }, () => 3000);
    expect(Core.rtPercentiles(few)).toBeNull();
    expect(Core.rtPercentiles([])).toBeNull();
    expect(Core.rtPercentiles(undefined)).toBeNull();
  });

  it("reports the learner's own median and upper quartile", () => {
    const p = Core.rtPercentiles(window());
    expect(p.n).toBe(40);
    expect(p.p50).toBe(5500);
    expect(p.p75).toBe(7750);
  });
});

describe("classifyResponse", () => {
  const pct = Core.rtPercentiles(window());

  it("classifies nothing before there is a distribution", () => {
    expect(Core.classifyResponse(1000, false, null)).toBe("unclassified");
    expect(Core.classifyResponse(1000, true, null)).toBe("unclassified");
  });

  it("classifies nothing from an unusable measurement", () => {
    expect(Core.classifyResponse(10, false, pct)).toBe("unclassified");
    expect(Core.classifyResponse(null, false, pct)).toBe("unclassified");
  });

  it("calls a quick wrong answer a misconception, not a gap", () => {
    expect(Core.classifyResponse(1200, false, pct)).toBe("confident-error");
    // Exactly at the median still counts as quick.
    expect(Core.classifyResponse(5500, false, pct)).toBe("confident-error");
  });

  it("calls a slow wrong answer a gap the learner can already feel", () => {
    expect(Core.classifyResponse(9000, false, pct)).toBe("known-gap");
  });

  it("calls a quick right answer fluent", () => {
    expect(Core.classifyResponse(1200, true, pct)).toBe("fluent");
    // Slower than the median but not past the upper quartile is still fluent.
    expect(Core.classifyResponse(6000, true, pct)).toBe("fluent");
  });

  it("calls a slow right answer fragile rather than secure", () => {
    expect(Core.classifyResponse(9000, true, pct)).toBe("effortful-correct");
  });
});

describe("applyFluency", () => {
  it("counts only the two labels that carry a warning", () => {
    expect(Core.applyFluency({}, "confident-error").fastWrong).toBe(1);
    expect(Core.applyFluency({}, "effortful-correct").slowRight).toBe(1);
    expect(Core.applyFluency({}, "fluent")).toEqual({});
    expect(Core.applyFluency({}, "known-gap")).toEqual({});
    expect(Core.applyFluency({}, "unclassified")).toEqual({});
  });

  it("accumulates across answers", () => {
    let st = {};
    st = Core.applyFluency(st, "confident-error");
    st = Core.applyFluency(st, "confident-error");
    expect(st.fastWrong).toBe(2);
  });
});

describe("answerFluency", () => {
  const questions = [{ id: "a", q: "A?" }, { id: "b", q: "B?" }, { id: "c", q: "C?" }];

  it("withholds its verdict, and says how much more is needed", () => {
    const f = Core.answerFluency(questions, { a: { fastWrong: 3 } }, [3000, 3000]);
    expect(f.ready).toBe(false);
    expect(f.needed).toBe(Core.MIN_RT_SAMPLES - 2);
    expect(f.medianMs).toBeNull();
    // The counts are still returned — a count is a count.
    expect(f.misconceptions).toHaveLength(1);
  });

  it("separates misconceptions from fragile knowledge, worst first", () => {
    const qstats = {
      a: { fastWrong: 1 },
      b: { fastWrong: 4 },
      c: { slowRight: 2 },
    };
    const f = Core.answerFluency(questions, qstats, window());
    expect(f.ready).toBe(true);
    expect(f.medianMs).toBe(5500);
    expect(f.slowMs).toBe(7750);
    expect(f.misconceptions.map((x) => x.q.id)).toEqual(["b", "a"]);
    expect(f.fragile.map((x) => x.q.id)).toEqual(["c"]);
  });

  it("ranks a question by its worse signal, never both", () => {
    const f = Core.answerFluency(questions, { a: { fastWrong: 1, slowRight: 5 } }, window());
    expect(f.misconceptions.map((x) => x.q.id)).toEqual(["a"]);
    expect(f.fragile).toHaveLength(0);
  });

  it("is empty-safe", () => {
    const f = Core.answerFluency([], {}, []);
    expect(f.misconceptions).toEqual([]);
    expect(f.fragile).toEqual([]);
    expect(f.ready).toBe(false);
  });
});

describe("fluency feeds selection", () => {
  const q = { id: "a", cat: "signs" };

  it("weights a misconception above an ordinary miss", () => {
    const plain = Core.adaptiveWeights(q, { seen: 3, correct: 1, wrong: 2 }, {}, 0);
    const fast = Core.adaptiveWeights(q, { seen: 3, correct: 1, wrong: 2, fastWrong: 2 }, {}, 0);
    expect(fast).toBeGreaterThan(plain);
  });

  it("leaves weighting unchanged when nothing was answered fast and wrong", () => {
    const a = Core.adaptiveWeights(q, { seen: 3, correct: 1, wrong: 2 }, {}, 0);
    const b = Core.adaptiveWeights(q, { seen: 3, correct: 1, wrong: 2, fastWrong: 0 }, {}, 0);
    expect(a).toBe(b);
  });

  it("puts misconceptions first in Review Missed", () => {
    const questions = [{ id: "a" }, { id: "b" }];
    const qstats = {
      a: { seen: 5, correct: 0, wrong: 5 },              // missed more often
      b: { seen: 2, correct: 1, wrong: 1, fastWrong: 1 }, // but this one they never saw coming
    };
    expect(Core.missedQuestions(questions, qstats).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("still orders by wrong count when neither is a misconception", () => {
    const questions = [{ id: "a" }, { id: "b" }];
    const qstats = { a: { wrong: 1 }, b: { wrong: 4 } };
    expect(Core.missedQuestions(questions, qstats).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("state schema", () => {
  it("defaults the new fields for a save written before response times existed", () => {
    const s = Core.sanitizeState({ v: Core.SCHEMA_VERSION, qstats: { a: { seen: 1, correct: 0, wrong: 1 } } });
    expect(s.qstats.a.fastWrong).toBe(0);
    expect(s.qstats.a.slowRight).toBe(0);
    expect(s.rtSamples).toEqual([]);
  });

  it("drops implausible stored measurements", () => {
    const s = Core.sanitizeState({ v: Core.SCHEMA_VERSION, rtSamples: [3000, 5, 1e9, "x", 4000] });
    expect(s.rtSamples).toEqual([3000, 4000]);
  });

  it("caps a stored window that grew too large", () => {
    const big = Array.from({ length: Core.MAX_RT_SAMPLES + 100 }, () => 3000);
    const s = Core.sanitizeState({ v: Core.SCHEMA_VERSION, rtSamples: big });
    expect(s.rtSamples).toHaveLength(Core.MAX_RT_SAMPLES);
  });
});
