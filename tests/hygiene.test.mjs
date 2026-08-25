/* Contamination guard: foreign-domain vocabulary must never reappear.
   The guard script must (a) pass on the shipped tree and (b) FAIL when a
   foreign term is planted. Terms are assembled at runtime so this file does
   not trip the scanner itself. */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function runHygiene() {
  try {
    const out = execFileSync("node", ["scripts/check-hygiene.mjs"], { cwd: ROOT, encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: e.stdout || e.message };
  }
}

describe("cross-project contamination guard", () => {
  it("passes on the shipped tree", () => {
    const { code, out } = runHygiene();
    if (code !== 0) throw new Error(out);
    expect(out).toContain("clean");
  });

  it("FAILS when debate vocabulary is planted in a tracked file", () => {
    // assemble the term so the scanner never sees it inside this test file
    const evil = ["re", "butt", "al"].join("");
    const probe = "planted-probe.html";
    writeFileSync(probe, `<button aria-label="${evil}">x</button>\n`);
    try {
      const { code, out } = runHygiene();
      expect(code).not.toBe(0);
      expect(out).toContain("debate terminology");
      expect(out).toContain(probe);
    } finally {
      unlinkSync(probe);
    }
  });
});
