/* Quiz keyboard contract: 1–4 answer, Enter advances.
 *
 * Every answered practice question leaves focus on #btnNext, so the documented
 * "Enter for next" flow is the main keyboard path. Enter used to advance only
 * while the question was UNANSWERED (the same branch that handles 1–4), so the
 * key did the opposite of its hint: nothing at the exact moment it was promised.
 */
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const QUIZ_SRC = readFileSync(fileURLToPath(new URL("../js/quiz-ui.js", import.meta.url)), "utf8");

const Q = {
  id: "q1", cat: "signs", q: "What does this sign mean?",
  choices: ["Stop", "Give way", "No entry", "One way"], a: 1, why: "Yield.",
};

function harness(mode = "practice") {
  const html = `
    <section id="view-quiz" class="view active">
      <div class="quiz-meta"><div class="qprog"><div class="qprog-bar" id="qprogBar"></div></div></div>
      <span id="qCounter"></span><span id="qTimer" hidden></span><span id="qCategory"></span>
      <button id="btnTTS" aria-pressed="false" hidden></button>
      <button id="btnFlag" aria-pressed="false"></button><button id="btnReport" aria-pressed="false"></button>
      <div id="signFrame" hidden></div><div id="qScene" hidden></div><div id="qCase" hidden></div>
      <h2 id="qText"></h2>
      <div id="choices" role="group"></div>
      <div id="feedback" hidden aria-live="assertive"><div id="fbHead"></div><div id="fbWhy"></div>
        <div id="fbRepair" hidden></div><a id="fbSource" hidden></a></div>
      <div id="reportPane" hidden>
        <select id="repKind"></select><textarea id="repNote"></textarea>
        <button id="btnReportSave"></button><button id="btnReportCancel"></button>
      </div>
      <button id="btnNext" disabled>Next</button>
      <button id="btnSkip" hidden>Skip</button>
      <button id="btnQuit">End</button>
      <p class="kbd-hint"></p>
    </section>`;
  const dom = new JSDOM(html, { url: "https://example.test/", pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  let nextCalls = 0;
  const sessionObj = { mode, questions: [Q, Q], i: 0, answers: [], requeued: {}, shownAt: 0, order: [] };
  let ui;
  ui = new Function("window", "document", `${QUIZ_SRC}; return window.RoadReadyQuizUI;`)(dom.window, dom.window.document);
  ui.init({
    CATEGORIES: { signs: { name: "Signs" } },
    icon: () => "",
    escapeHTML: (s) => String(s),
    signArt: () => "",
    shuffle: (a) => a,
    speak: () => {},
    Core: {
      conceptKeyOf: () => "k",
      groupByConcept: () => new Map(),
      rtPercentiles: () => null,
      fileIssueReport: () => ({ ok: true }),
      ISSUE_KINDS: ["typo"],
    },
    Coach: { confusionLine: () => null, conceptLabel: (k) => k },
    Explain: null,
    Mastery: null,
    getState: () => ({ settings: { feedback: true }, qstats: {}, rtSamples: [], flagged: {}, issueReports: {}, misconceptions: {} }),
    getBank: () => [Q],
    getSession: () => sessionObj,
    recordAnswer: () => {},
    finishSession: () => {},
    citationForQuestion: () => null,
    save: () => {},
    nextQuestion: () => { nextCalls++; sessionObj.answeredCurrent = false; sessionObj.i++; },
  });
  dom.window.document.addEventListener("keydown", (event) => {
    if (event.key >= "1" && event.key <= "4") ui.answerDisplayPosition(Number(event.key) - 1);
    if (event.key === "Enter" && ui.handleEnter()) event.preventDefault();
  });
  // A silent render failure would make every assertion below lie ("0 choices"
  // for an unrelated reason), so surface any error from renderQuiz directly.
  const errs = [];
  dom.window.addEventListener("error", (e) => errs.push(String(e.message)));
  try {
    ui.renderQuiz();
  } catch (e) {
    errs.push(String((e && e.stack) || e));
  }
  if (errs.length) throw new Error("renderQuiz failed: " + errs.join(" | "));
  return {
    dom,
    session: sessionObj,
    ui,
    doc: dom.window.document,
    pressKey: (key) => {
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    },
    clickNext: () => { nextCalls++; },
    get nextCalls() { return nextCalls; },
  };
}

describe("quiz keyboard flow", () => {
  it("every rendered choice carries an accessible name for speech/switch users", () => {
    const h = harness();
    // A silent render failure would make the assertion below lie ("0 choices"
    // for an unrelated reason), so surface any error from renderQuiz directly.
    try {
      h.ui.renderQuiz();
    } catch (e) {
      throw new Error("renderQuiz failed: " + String((e && e.stack) || e));
    }
    const choices = [...h.doc.querySelectorAll("#choices .choice")];
    expect(choices).toHaveLength(4);
    for (const [i, b] of choices.entries()) {
      expect(b.getAttribute("aria-label"), `choice ${i + 1} named`).toBe(`${i + 1}. ${Q.choices[i]}`);
    }
  });

  it("1–4 answers and Enter then advances the way the kbd hint promises", () => {
    const h = harness();
    h.ui.renderQuiz();
    h.pressKey("2");
    expect(h.session.answers).toHaveLength(1);
    expect(h.session.answers[0].picked).toBe(1);
    // Answered: focus sits on #btnNext. Enter is the documented "next" key.
    h.pressKey("Enter");
    expect(h.session.i).toBe(1); // old code left i at 0 forever
    expect(h.nextCalls).toBe(1); // native Enter activation must not advance twice
  });

  it("Enter while the question is still unanswered answers the first choice, not skip", () => {
    const h = harness();
    h.ui.renderQuiz();
    h.pressKey("Enter");
    expect(h.session.answers).toHaveLength(1);
    expect(h.session.answers[0].picked).toBe(0);
  });

  it("Enter never double-answers while the exam auto-advance timer is pending", () => {
    const h = harness("exam");
    h.ui.renderQuiz();
    h.pressKey("3");
    expect(h.session.answers).toHaveLength(1);
    // The 420ms advance timer owns the queue until it fires; Enter must not
    // queue a second answer or jump the index itself.
    h.pressKey("Enter");
    expect(h.session.answers).toHaveLength(1);
    expect(h.session.i).toBe(0);
  });
});
