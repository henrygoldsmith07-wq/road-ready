/* Learn-before-drilling: the concept map teaches the verified rule and the
 * Weakness Centre rule note cites it — both reuse only content QA already
 * provenance-resolved (curated registry paraphrases, else the bank's own
 * explanations). This test guards the contract bank-wide and renders the
 * concept-map Learn block in jsdom: rule present, trap only when curated,
 * source line never "undefined", teaching placed before the drill action. */
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Core from "../js/core.js";
import Mastery from "../js/mastery.js";
import Concepts from "../js/concepts.js";
import Packs from "../js/state-packs.js";
import { loadContent } from "../scripts/content-loader.mjs";

const data = loadContent();
// conceptMeta()/explanationFor() resolve the bank through globals at call
// time (classic-script scope in the browser); provide the same here.
globalThis.QUESTIONS = data.QUESTIONS;
globalThis.STATE_PACKS = data.STATE_PACKS;
globalThis.SOURCE_REGISTRY = data.SOURCE_REGISTRY;

const jurOf = (q) => (Array.isArray(q.jurisdiction) && q.jurisdiction.length ? q.jurisdiction[0] : "generic");
const TOKEN_RE = /undefined|NaN|\[object/;

describe("concept teaching contract (bank-wide)", () => {
  it("every concept resolves a non-empty verified rule", () => {
    const missing = [];
    for (const q of data.QUESTIONS) {
      const key = q.concept || `topic:${q.cat}`;
      const m = Concepts.conceptMeta(key, jurOf(q));
      if (!m || !m.rule) missing.push(`${q.id}/${key}`);
    }
    expect(missing).toEqual([]);
  });

  it("watchFor appears only on curated concepts (never invented)", () => {
    const bad = [];
    for (const q of data.QUESTIONS) {
      const key = q.concept || `topic:${q.cat}`;
      const m = Concepts.conceptMeta(key, jurOf(q));
      if (m && m.watchFor && !m.curated) bad.push(`${q.id}/${key}`);
    }
    expect(bad).toEqual([]);
  });

  it("no teaching string renders an unresolved token", () => {
    const bad = [];
    const keys = new Set(data.QUESTIONS.map((q) => q.concept || `topic:${q.cat}`));
    for (const key of keys) {
      const m = Concepts.conceptMeta(key, "generic");
      for (const field of ["name", "rule", "watchFor"]) {
        const v = m && m[field];
        if (typeof v === "string" && TOKEN_RE.test(v)) bad.push(`${key}.${field}: ${v}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

const CM_SRC = readFileSync(fileURLToPath(new URL("../js/concept-map-ui.js", import.meta.url)), "utf8");

function makeMap(bank) {
  const dom = new JSDOM(`
    <h1 id="cmTitle"></h1><p id="cmSub"></p>
    <div id="cmStatements"></div><div id="cmList"></div>
    <button id="btnCmDrill"></button><button id="btnCmBack"></button>
  `);
  new Function("window", "document", CM_SRC)(dom.window, dom.window.document);
  const ui = dom.window.RoadReadyConceptMapUI;
  ui.init({
    Core,
    Mastery,
    CATEGORIES: { sg: { name: "Signs" } },
    getState: () => ({ qstats: {}, misconceptions: {} }),
    getBank: () => bank,
    icon: () => "",
    startPractice: () => {},
    shuffle: (a) => a,
    showView: () => {},
    conceptMeta: (key) => Concepts.conceptMeta(key, "generic"),
    citationForQuestion: (q) => Packs.citationForQuestion(q),
  });
  return { dom, ui };
}

const q = (id, concept, why) => ({
  id, cat: "sg", concept, why,
  choices: ["Stop fully", "Slow down"],
  a: 0,
  sourceId: "us-dmv-handbooks-composite",
});

describe("concept-map Learn block", () => {
  const bank = [
    q("learn-1", "right-of-way", "Yield where the rules place others ahead of you."),
    q("learn-2", "right-of-way", "Yield where the rules place others ahead of you."),
    q("learn-3", "custom-brake-rule", "Ease off the gas on a slippery surface and steer where you want to go."),
  ];
  const { dom, ui } = makeMap(bank);
  // Render needs the fake bank visible through the concepts module's global
  // lookup; restore the full bank synchronously afterwards so the bank-wide
  // contract tests above keep resolving against all 2311 questions (describe
  // bodies run at collection, before any it() executes).
  const savedQuestions = globalThis.QUESTIONS;
  globalThis.QUESTIONS = bank;
  ui.render("sg");
  globalThis.QUESTIONS = savedQuestions;
  const doc = dom.window.document;
  const cards = [...doc.querySelectorAll("#cmList .cm-card")];

  it("renders a Learn block on every concept card", () => {
    expect(cards.length).toBe(2);
    for (const card of cards) {
      expect(card.querySelector(".cm-learn")).toBeTruthy();
    }
  });

  it("curated concept shows the registry rule, its trap, and a clean source line", () => {
    const card = cards.find((c) => c.textContent.toLowerCase().includes("right of way"));
    expect(card).toBeTruthy();
    expect(card.querySelector(".cm-rule").textContent).toContain("Right of way is given, not taken");
    expect(card.querySelector(".cm-trap").textContent).toContain("Assuming that being in the right");
    const src = card.querySelector(".cm-source").textContent;
    expect(src).toContain("Reference basis");
    expect(TOKEN_RE.test(src)).toBe(false);
  });

  it("uncurated concept falls back to the bank's own explanation with no invented trap", () => {
    const card = cards.find((c) => c.textContent.toLowerCase().includes("custom brake rule"));
    expect(card).toBeTruthy();
    expect(card.querySelector(".cm-rule").textContent).toContain("Ease off the gas on a slippery surface");
    expect(card.querySelector(".cm-trap")).toBe(null);
  });

  it("teaching sits above the drill action", () => {
    for (const card of cards) {
      const learnPos = card.innerHTML.indexOf("cm-learn");
      const actionPos = card.innerHTML.indexOf("cm-action");
      expect(learnPos).toBeGreaterThan(-1);
      expect(actionPos).toBeGreaterThan(-1);
      expect(learnPos).toBeLessThan(actionPos);
    }
  });
});
