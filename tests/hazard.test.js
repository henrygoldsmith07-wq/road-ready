/* Hazard-perception scoring */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

// A typical scenario window from app: win [3.0, 5.6]
const S = 3.0, E = 5.6;

describe("hazard scoring", () => {
  it("no press scores zero (too late)", () => {
    expect(Core.hazardScore(null, S, E)).toEqual({ pts: 0, band: "late" });
    expect(Core.hazardScore(undefined, S, E).pts).toBe(0);
  });

  it("pressing before the window opens scores zero (too early)", () => {
    expect(Core.hazardScore(S - 1, S, E)).toEqual({ pts: 0, band: "early" });
    expect(Core.hazardScore(S - 0.36, S, E).pts).toBe(0);
  });

  it("the grace edge (start-0.35) is the earliest scoring press", () => {
    const r = Core.hazardScore(S - 0.35 + 0.001, S, E);
    expect(r.pts).toBe(5);
    expect(r.band).toBe("instant");
  });

  it("scores decay from 5 to at least 1 across the window", () => {
    const pts = [];
    for (let t = S; t <= E; t += 0.2) pts.push(Core.hazardScore(t, S, E).pts);
    for (let i = 1; i < pts.length; i++) expect(pts[i]).toBeLessThanOrEqual(pts[i - 1]);
    expect(Math.min(...pts)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...pts)).toBe(5);
  });

  it("pressing after the window still earns the minimum point", () => {
    const r = Core.hazardScore(E + 2, S, E);
    expect(r.pts).toBe(1);
    expect(r.band).toBe("close");
  });

  it("bands map to the UI verdicts in time order", () => {
    expect(Core.hazardScore(S, S, E).band).toBe("instant");
    expect(Core.hazardScore((S + E) / 2 - 0.01, S, E).band).toBe("good");
    expect(Core.hazardScore(E, S, E).band).toBe("close");
  });

  it("every shipped scenario awards max points inside its own window", () => {
    // mirrors HZ_SCENARIOS windows in app.js
    const scenarios = [
      [2.6, 6.0], [3.0, 5.6], [3.0, 5.1], [3.2, 4.9], [3.0, 5.4], [2.6, 4.6],
    ];
    scenarios.forEach(([s, e]) => {
      expect(Core.hazardScore(s, s, e).pts).toBe(5);
    });
  });
});
