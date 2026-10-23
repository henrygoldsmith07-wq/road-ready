/* Practice session summary: it must account for every name it does not print.
 *
 * The screen used to read "7 misconceptions resolved: No U Turn sign, One Way
 * sign" — the slice() silently dropped five of them, which looks like an
 * arithmetic error on the one screen whose job is to be trustworthy. It also
 * repeated the heading and the score printed directly above it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const SRC = readFileSync(fileURLToPath(new URL("../js/results-ui.js", import.meta.url)), "utf8");

function makeUI() {
  const dom = new JSDOM('<section id="sessionSummary" hidden></section>', { url: "https://example.test/" });
  const savedWindow = globalThis.window;
  const savedDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let ui;
  try {
    const load = new Function("window", "document", `${SRC}; return window.RoadReadyResultsUI;`);
    ui = load(dom.window, dom.window.document);
  } finally {
    if (savedWindow === undefined) delete globalThis.window;
    else globalThis.window = savedWindow;
    if (savedDocument === undefined) delete globalThis.document;
    else globalThis.document = savedDocument;
  }
  return { dom, ui };
}

describe("practice session summary", () => {
  it("accounts for the names it leaves out", () => {
    const { dom, ui } = makeUI();
    ui.renderSessionSummary({
      questionCount: 26,
      correct: 9,
      strengthened: ["a", "b", "c", "d", "e"],
      resolvedMisconceptions: ["m1", "m2", "m3", "m4", "m5", "m6", "m7"],
      stillWeak: ["w1"],
      coverageDelta: 3,
      nextAction: "Drill lane selection",
    }, 0);
    const host = dom.window.document.getElementById("sessionSummary");
    expect(host.hidden).toBe(false);
    const text = host.textContent;
    expect(text).toContain("5 concepts strengthened: a, b, c and 2 more");
    expect(text).toContain("7 misconceptions resolved: m1, m2 and 5 more");
    expect(text).toContain("1 concept still weak: w1");
    expect(text).toContain("Coverage +3%");
    expect(text).toContain("Best next action: Drill lane selection.");
  });

  it("does not restate the heading or the score printed above it", () => {
    const { dom, ui } = makeUI();
    ui.renderSessionSummary({
      questionCount: 26,
      correct: 9,
      strengthened: [],
      resolvedMisconceptions: [],
      stillWeak: [],
      coverageDelta: 0,
      nextAction: null,
    }, 0);
    const text = dom.window.document.getElementById("sessionSummary").textContent;
    expect(text).toContain("What this session changed");
    expect(text).not.toContain("Session complete");
    expect(text).not.toContain("26 questions");
    expect(text).toContain("No measurable change yet");
  });

  it("lists unattempted questions only when a bounded set was left early", () => {
    const { dom, ui } = makeUI();
    ui.renderSessionSummary({
      questionCount: 10,
      correct: 4,
      strengthened: [],
      resolvedMisconceptions: [],
      stillWeak: [],
      coverageDelta: null,
      nextAction: null,
    }, 3);
    expect(dom.window.document.getElementById("sessionSummary").textContent)
      .toContain("3 questions were not attempted");
  });
});
