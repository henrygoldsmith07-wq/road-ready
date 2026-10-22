import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import Core from "../js/core.js";

const HTML = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const UI_SRC = readFileSync(fileURLToPath(new URL("../js/commute-ui.js", import.meta.url)), "utf8");

function ids(html, id) {
  return (html.match(new RegExp(`id="${id}"`, "g")) || []).length;
}

describe("commute view ids", () => {
  it("does not collide with the concept-map view", () => {
    expect(ids(HTML, "cmSub")).toBe(1);
    expect(ids(HTML, "cmList")).toBe(1);
    expect(ids(HTML, "coSub")).toBe(1);
    expect(ids(HTML, "coList")).toBe(1);
    expect(ids(HTML, "coPlay")).toBe(1);
    expect(ids(HTML, "coAuto")).toBe(1);
  });
});

function makeCommute(qstats = {}) {
  const bank = [
    { id: "a", q: "Q a?", choices: ["yes", "no"], a: 0, why: "Because a." },
    { id: "b", q: "Q b?", choices: ["yes", "no"], a: 1, why: "Because b." },
  ];
  const dom = new JSDOM(`
    <p id="coSub"></p><span id="coPos"></span>
    <button id="coPrev"></button><button id="coPlay"></button><button id="coNext"></button>
    <button id="coAuto"></button><button id="coStop"></button>
    <p id="coSupport" hidden></p><div id="coList"></div>
  `, { url: "https://example.test/" });
  // jsdom has no speechSynthesis: module must degrade to a readable list.
  const run = new Function("window", "document", `${UI_SRC}; return window.RoadReadyCommuteUI;`);
  // Run with the JSDOM globals temporarily installed so the classic script
  // sees `document`/`window` as bare globals like in the browser.
  const savedWindow = globalThis.window;
  const savedDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let ui;
  try {
    ui = run(dom.window, dom.window.document);
  } finally {
    if (savedWindow === undefined) delete globalThis.window;
    else globalThis.window = savedWindow;
    if (savedDocument === undefined) delete globalThis.document;
    else globalThis.document = savedDocument;
  }
  ui.init({
    Core,
    getState: () => ({ qstats }),
    getBank: () => bank,
  });
  return { dom, ui };
}

describe("commute-ui module", () => {
  it("renders a readable list and degrades without TTS", () => {
    const { dom, ui } = makeCommute();
    ui.render();
    const doc = dom.window.document;
    expect(doc.querySelectorAll("#coList .commute-item").length).toBe(2);
    // No speechSynthesis in jsdom: Play is disabled, support note shows.
    expect(doc.getElementById("coPlay").disabled).toBe(true);
    expect(doc.getElementById("coSupport").hidden).toBe(false);
  });

  it("toggles autoplay label and survives re-render", () => {
    const { dom, ui } = makeCommute();
    ui.render();
    const doc = dom.window.document;
    const auto = doc.getElementById("coAuto");
    expect(auto.textContent).toBe("Autoplay on");
    auto.click();
    expect(auto.textContent).toBe("Autoplay off");
    expect(auto.getAttribute("aria-pressed")).toBe("false");
    ui.render();
    expect(doc.querySelectorAll("#coList .commute-item").length).toBe(2);
  });
});
