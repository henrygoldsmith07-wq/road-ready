import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("../js/guide.js", import.meta.url)), "utf8");

function makeGuide() {
  const dom = new JSDOM(`
    <p id="guideSubtitle"></p>
    <div id="guideUs"></div>
    <div id="guideGb" hidden></div>
  `);
  new Function("window", "document", SRC)(dom.window, dom.window.document);
  return dom;
}

describe("jurisdiction-native guide", () => {
  it("shows only the U.S. guide for a U.S. jurisdiction", () => {
    const dom = makeGuide();
    dom.window.RoadReadyGuide.apply({
      country: { guide: { scope: "us", subtitle: "US guide" } },
      sourceRegistry: {},
    });
    expect(dom.window.document.getElementById("guideUs").hidden).toBe(false);
    expect(dom.window.document.getElementById("guideGb").hidden).toBe(true);
    expect(dom.window.document.getElementById("guideSubtitle").textContent).toBe("US guide");
  });

  it("the GB practical-test link goes to official GOV.UK guidance", () => {
    /* It used to be href="#": a link labelled "official" that went nowhere. */
    const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
    const link = html.match(/id="gbPracticalSource"[^>]*href="([^"]+)"/);
    expect(link).toBeTruthy();
    expect(link[1]).toBe("https://www.gov.uk/driving-test/what-happens-during-test");
  });

  it("hides U.S. content for Great Britain", () => {
    const dom = makeGuide();
    dom.window.RoadReadyGuide.apply({
      country: { guide: { scope: "gb", subtitle: "GB guide" } },
    });
    expect(dom.window.document.getElementById("guideUs").hidden).toBe(true);
    expect(dom.window.document.getElementById("guideGb").hidden).toBe(false);
  });
});
