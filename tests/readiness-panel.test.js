/* Readiness home panel: band, strong/risk topics, daily recommendation */
import { describe, it, expect } from "vitest";
import Core from "../js/core.js";

describe("readinessBand", () => {
  it("maps percentages to honest bands", () => {
    expect(Core.readinessBand(0).label).toBe("Not Started");
    expect(Core.readinessBand(30).label).toBe("Early Days");
    expect(Core.readinessBand(60).label).toBe("Getting There");
    expect(Core.readinessBand(80).label).toBe("Nearly Ready");
    expect(Core.readinessBand(95).label).toBe("Ready");
  });
});

describe("strongAndRiskTopics", () => {
  const topics = [
    { id: "signs", name: "Signs & Signals", mastery: 0.92, seen: true },
    { id: "speed", name: "Speed & Distance", mastery: 0.85, seen: true },
    { id: "row", name: "Right of Way", mastery: 0.55, seen: true },
    { id: "parking", name: "Parking & Stopping", mastery: 0.4, seen: true },
    { id: "alcohol", name: "Alcohol & Drugs", mastery: null, seen: false },
  ];

  it("picks the two strongest and two riskiest with data", () => {
    const { strong, risk } = Core.strongAndRiskTopics(topics);
    expect(strong.map((t) => t.id)).toEqual(["signs", "speed"]);
    expect(risk.map((t) => t.id)).toEqual(["parking", "row"]); // lowest first
  });

  it("never lists unseen topics as strong or risk", () => {
    const { strong, risk } = Core.strongAndRiskTopics(topics);
    expect(strong.concat(risk).some((t) => t.id === "alcohol")).toBe(false);
  });

  it("mid-range topics appear in neither list", () => {
    const only = [{ id: "laws", name: "Laws", mastery: 0.7, seen: true }];
    const { strong, risk } = Core.strongAndRiskTopics(only);
    expect(strong).toEqual([]);
    expect(risk).toEqual([]);
  });
});

describe("recommendedToday", () => {
  it("uses the test date to spread unmastered questions across remaining days", () => {
    const n = Core.recommendedToday({ unmasteredQuestions: 120, daysUntilTest: 6, dailyGoal: 10, riskCount: 2 });
    expect(n).toBe(20); // ceil(120/6)
  });

  it("clamps the test-date recommendation to [10, 40]", () => {
    expect(Core.recommendedToday({ unmasteredQuestions: 3, daysUntilTest: 1 })).toBe(10);
    expect(Core.recommendedToday({ unmasteredQuestions: 900, daysUntilTest: 5 })).toBe(40);
  });

  it("without a test date: daily goal plus a bump per risk topic", () => {
    expect(Core.recommendedToday({ unmasteredQuestions: 50, daysUntilTest: null, dailyGoal: 10, riskCount: 0 })).toBe(10);
    expect(Core.recommendedToday({ unmasteredQuestions: 50, daysUntilTest: null, dailyGoal: 10, riskCount: 2 })).toBe(20);
    expect(Core.recommendedToday({ unmasteredQuestions: 50, daysUntilTest: null, dailyGoal: 15, riskCount: 4 })).toBe(25);
  });

  it("returns 0 when the bank is mastered", () => {
    expect(Core.recommendedToday({ unmasteredQuestions: 0, daysUntilTest: 3, dailyGoal: 10, riskCount: 1 })).toBe(0);
  });
});
