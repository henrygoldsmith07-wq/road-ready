/* Product-statistics consistency: the README's documented figures must always
   match the source modules. scripts/product-stats.mjs derives every figure
   from the question banks, sign library and hazard scenario bank; this test
   pins the mechanism so documented drift cannot return. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { derive, checkReadme } from "../scripts/product-stats.mjs";

const README = readFileSync(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");

describe("product statistics are derived from source", () => {
  it("derives every figure from the actual modules", () => {
    const f = derive();
    expect(f.totalQuestions).toBeGreaterThan(0);
    expect(f.universalQuestions).toBeGreaterThan(0);
    expect(f.gbQuestions).toBeGreaterThan(0);
    expect(f.signs).toBeGreaterThan(0);
    expect(f.scenarios).toBeGreaterThan(0);
    // internal consistency: the parts sum to the whole
    expect(f.gbQuestions + f.universalQuestions).toBeLessThanOrEqual(f.totalQuestions);
    expect(f.gbConcepts).toBeLessThanOrEqual(f.gbQuestions);
    // multi-hazard scenes are a subset of the scenario bank
    expect(f.multiHazard).toBeGreaterThanOrEqual(0);
    expect(f.multiHazard).toBeLessThanOrEqual(f.scenarios);
  });

  it("the README matches the code on every documented figure", () => {
    const problems = checkReadme(README, derive());
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("detects a stale figure instead of passing it", () => {
    const f = derive();
    const tampered = README.replace(
      /(\d+) original animated scenarios/,
      (whole, n) => whole.replace(n, String(Number(n) + 7)),
    );
    expect(tampered).not.toBe(README);
    const problems = checkReadme(tampered, f);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(" ")).toMatch(/hazard scenario count/);
  });

  it("detects a deleted claim instead of passing it", () => {
    const f = derive();
    const tampered = README.replace(/(\d+) hand-drawn SVG road signs/, "some signs");
    const problems = checkReadme(tampered, f);
    expect(problems.join(" ")).toMatch(/sign count/);
  });

  it("detects a missing generated block", () => {
    const f = derive();
    const tampered = README.replace(/<!-- product-stats:begin -->[\s\S]*?<!-- product-stats:end -->/, "");
    const problems = checkReadme(tampered, f);
    expect(problems.join(" ")).toMatch(/block is missing/);
  });
});
