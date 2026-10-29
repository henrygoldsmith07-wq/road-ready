/* Today Plan card: the "past test date" branch must own the whole card.
 *
 * When the saved test date has passed, the branch switches the title and the
 * primary button to "Update your test date", but used to leave the four
 * explain fields (amount / noticed / why / goal) plus the evidence drawer
 * carrying the coach recommendation rendered moments earlier — a card whose
 * headline said one thing and whose body advertised a practice session that
 * the button below it could not start.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const SRC = readFileSync(fileURLToPath(new URL("../js/home-ui.js", import.meta.url)), "utf8");

function ids(html, id) {
  return (html.match(new RegExp(`id="${id}"`, "g")) || []).length;
}

describe("past-date plan branch owns the whole card", () => {
  it("home markup carries every field the past-date branch must clear", () => {
    // Guards the test itself against markup drift: if a field is renamed,
    // this fails instead of the branch silently missing it again.
    const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
    for (const id of ["planAmount", "planNoticed", "planWhy", "planGoal", "planEvidence"]) {
      expect(ids(html, id), `#${id} in index.html`).toBe(1);
    }
  });

  it("clears the coach copy when the test date has passed", () => {
    const html = `
      <p id="heroSub"></p><span id="heroLvl"></span><span id="hazardBestLabel"></span>
      <p id="dailyGoal"><span class="dg-bar"><span class="dg-bar-fill"></span></span><span class="dg-label"></span></p>
      <p id="dgReminder" hidden></p>
      <p id="planChanged" hidden></p>
      <div class="card today-plan" id="todayPlanCard">
        <div class="plan-kicker" id="planKicker"></div>
        <div class="plan-title" id="planTitle"></div>
        <p class="plan-detail" id="planDetail"></p>
        <div class="plan-amount" id="planAmount">10 questions — ~8 min</div>
        <div class="plan-noticed" id="planNoticed">You keep getting X wrong.</div>
        <p class="plan-why" id="planWhy">Repeated errors mean…</p>
        <p class="plan-goal" id="planGoal">Goal: get 3 variations right…</p>
        <div class="plan-kind" id="planKind">What's behind it: misconception</div>
        <ul class="plan-rationale" id="planRationale"></ul>
        <details class="plan-evidence" id="planEvidence" open><summary>Why Road Ready chose this</summary><ul id="planEvidenceList"></ul></details>
        <div class="plan-meta" id="planMeta"></div>
        <button class="btn primary" id="btnPlanAction">Start 10-question session</button>
        <button class="btn ghost" id="btnPlanDate" hidden>Set test date</button>
      </div>`;
    const dom = new JSDOM(html);
    const savedWindow = globalThis.window;
    const savedDocument = globalThis.document;
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    let ui;
    try {
      ui = new Function("window", "document", `${SRC}; return window.RoadReadyHomeUI;`)(dom.window, dom.window.document);
    } finally {
      if (savedWindow === undefined) delete globalThis.window;
      else globalThis.window = savedWindow;
      if (savedDocument === undefined) delete globalThis.document;
      else globalThis.document = savedDocument;
    }

    const today = "2026-10-27";
    ui.init({
      Core: {
        // plan with a PASSED test date
        studyPlan: () => ({ status: "past", daysLeft: -1, dailyTarget: 10, todayCount: 0, remainingToday: 10, unseen: 4, weak: 0, reviewsDue: 0, overdueToday: 0 }),
        clampDailyGoal: () => 10,
        sanitizeReminder: () => ({ enabled: false, time: "19:00", lastFired: "" }),
        localDayBefore: () => "2026-10-26",
        streakAtRisk: () => false,
        topicMastery: () => 0,
      },
      Coach: {
        REC_TYPES: { TAKE_MOCK: "take-mock", LIGHT_REVIEW: "light-review", HAZARD_TRAINING: "hazard-training" },
        recommend: () => ({
          primary: {
            type: "fix-misconception", title: "Fix 1 misconception", detail: "Practice these next.",
            conceptKeys: ["junction-priority"], questionCount: 10, issueKind: "misconception",
            why: ["evidence"], evidence: [],
          },
        }),
        sessionDelta: () => ({ lines: [] }),
        buildSnapshot: () => ({}),
        activeMisconceptions: () => [],
        conceptLabel: (k) => k,
      },
      getState: () => ({
        answered: 30, correctCount: 24, xp: 100, hazardBest: 12,
        exams: [], coach: {}, coachEvents: [], settings: { testDate: "2026-10-20", reminder: { enabled: false } },
        misconceptions: {}, qstats: {},
      }),
      getBank: () => [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }],
      catQ: () => [],
      catAccuracy: () => null,
      readiness: () => 0.4,
      todayStr: () => today,
      validTestDate: () => true, // a date IS set — it has simply passed
      termsForPack: () => ({ agencyShort: "DVSA", examName: "theory test", regionLabel: "Great Britain" }),
      hazardInfoForPack: () => ({ includedInExam: false }),
      hazardScenarioCount: () => 35,
      checkProgressAchievements: () => {},
      levelFor: () => ({ lvl: 2 }),
      predictionCalibrationSamples: () => [],
      buildCalibrationCurve: () => null,
      CALIBRATION_CONTEXT: () => ({}),
      ConceptMapUI: null,
      save: () => {},
      icon: () => "",
      startPractice: () => {},
      shuffle: (a) => a,
      showView: () => {},
    });

    ui.renderPlan();

    const doc = dom.window.document;
    // The title and the action promise the date fix…
    expect(doc.getElementById("planTitle").textContent).toBe("Update your test date");
    const btn = doc.getElementById("btnPlanAction");
    expect(btn.textContent).toBe("Choose a date");
    expect(btn.dataset.action).toBe("set-date");
    // …so no stale coach copy may advertise the session that used to be planned.
    for (const id of ["planAmount", "planNoticed", "planWhy", "planGoal", "planKind"]) {
      const el = doc.getElementById(id);
      expect(el.hidden, `#${id} hidden`).toBe(true);
      expect(el.textContent, `#${id} empty`).toBe("");
    }
    expect(doc.getElementById("planEvidence").hidden).toBe(true);
    expect(doc.getElementById("planEvidence").open).toBe(false);
    expect(doc.getElementById("planRationale").hidden).toBe(true);
    expect(doc.getElementById("planChanged").hidden).toBe(true);
  });
});
