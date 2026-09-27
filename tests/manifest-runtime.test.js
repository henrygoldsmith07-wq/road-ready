// Content manifest: development-side only.
//
// content-manifest.json carries provenance fingerprints for the strict content
// QA pipeline (scripts/validate-content.mjs) and must never be fetched by the
// browser: it is not precached by the service worker and no runtime code
// imports it. This test keeps it that way — if a future change starts shipping
// it to clients, ship the validation output instead, not the QA machinery.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

describe("content manifest stays development-side", () => {
  const sw = readFileSync(`${ROOT}sw.js`, "utf8");
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];

  it("is not precached by the service worker", () => {
    expect(shell.includes("content-manifest")).toBe(false);
  });

  it("is not referenced by any browser-loaded script", () => {
    const browserScripts = ["app.js", "core.js", "account.js", "account-ui.js", "practical-ui.js", "guide.js", "icons.js", "signs.js", "jurisdictions.js", "state-packs.js", "exam-blueprints.js"];
    for (const file of browserScripts) {
      const src = readFileSync(`${ROOT}js/${file}`, "utf8");
      expect(src.includes("content-manifest.json"), file).toBe(false);
    }
    const html = readFileSync(`${ROOT}index.html`, "utf8");
    expect(html.includes("content-manifest.json")).toBe(false);
  });
});
