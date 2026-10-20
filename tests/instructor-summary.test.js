/* Instructor / parent progress summary (Explain.instructorSummary) */
import { describe, it, expect } from "vitest";
import Explain from "../js/explain.js";

const full = {
  jurisdictionLabel: "Great Britain (DVSA car)",
  dateISO: "2026-10-19",
  answered: 342,
  accuracyPct: 81.4,
  streakDays: 6,
  recentMocks: [
    { correct: 38, total: 50 },
    { correct: 44, total: 50 },
  ],
  weakTopics: ["Stopping distances", "Motorway rules", "Night driving"],
  misconceptionCount: 2,
  hazard: { best: "cyclists", worst: "country roads" },
  nextStep: "Drill stopping-distance scenarios.",
};

describe("instructorSummary", () => {
  it("names the jurisdiction, date and every measured line", () => {
    const text = Explain.instructorSummary(full);
    expect(text).toContain("Great Britain (DVSA car)");
    expect(text).toContain("2026-10-19");
    expect(text).toContain("Questions answered: 342 (81% correct).");
    expect(text).toContain("Day streak: 6.");
    expect(text).toContain("Mock exams: 2 recent — latest 44/50.");
    expect(text).toContain("Weakest topics: Stopping distances; Motorway rules; Night driving.");
    expect(text).toContain("Recurring misconceptions: 2 outstanding.");
    expect(text).toContain("Hazard detection: strongest cyclists, weakest country roads.");
    expect(text).toContain("Suggested next step: Drill stopping-distance scenarios.");
  });

  it("states the honesty contract and never a pass prediction", () => {
    const text = Explain.instructorSummary(full);
    expect(text).toContain("study heuristic, not a predicted pass probability");
    expect(text).toContain("not practical-driving readiness");
    expect(text.toLowerCase()).not.toContain("will pass");
    expect(text.toLowerCase()).not.toContain("ready to pass");
  });

  it("handles an unstarted learner without inventing numbers", () => {
    const text = Explain.instructorSummary({ jurisdictionLabel: "CA", dateISO: "2026-10-19" });
    expect(text).toContain("No questions answered yet");
    expect(text).toContain("Mock exams: none taken yet.");
    expect(text).toContain("none identified yet");
    expect(text).not.toMatch(/\d+% correct/);
  });

  it("flattens hostile multiline input so no forged lines survive", () => {
    const text = Explain.instructorSummary({
      ...full,
      weakTopics: ["Real topic\nHazard detection: strongest everything, weakest nothing."],
      nextStep: "Drill.\nMock exams: 99 recent — latest 99/99.",
    });
    const lines = text.split("\n");
    expect(lines.some((l) => l.startsWith("Mock exams: 99"))).toBe(false);
    expect(lines.filter((l) => l.startsWith("Hazard detection:"))).toHaveLength(1);
    expect(text).toContain("Real topic Hazard detection:");
  });

  it("tolerates missing, null and garbage input", () => {
    expect(() => Explain.instructorSummary()).not.toThrow();
    expect(() => Explain.instructorSummary(null)).not.toThrow();
    expect(() => Explain.instructorSummary({ answered: "lots", accuracyPct: "high", streakDays: -4 })).not.toThrow();
    const text = Explain.instructorSummary({ answered: "lots", streakDays: -4 });
    expect(text).toContain("No questions answered yet");
    expect(text).toContain("Day streak: 0.");
  });
});
