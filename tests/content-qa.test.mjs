/* Content QA system — runs the real checks against the real bank */
import { describe, it, expect } from "vitest";
import { loadContent } from "../scripts/content-loader.mjs";
import { runChecks } from "../scripts/content-checks.mjs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const data = loadContent();
const { QUESTIONS, CATEGORIES, SIGNS, STATE_PACKS } = data;

describe("content QA system", () => {
  const { errors, warnings, stats } = runChecks(data);

  it("bank loads and matches the documented size", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(150);
    expect(Object.keys(CATEGORIES).length).toBe(10);
    expect(Object.keys(SIGNS).length).toBeGreaterThanOrEqual(25);
  });

  it("passes schema validation with zero errors", () => {
    const schemaErrors = errors.filter((e) => e.rule === "schema" || e.rule === "signs-ref");
    expect(schemaErrors).toEqual([]);
  });

  it("has no duplicate questions or duplicate answers", () => {
    expect(errors.filter((e) => e.rule === "dup-question")).toEqual([]);
    expect(errors.filter((e) => e.rule === "dup-answer")).toEqual([]);
  });

  it("has no broken explanations (placeholders / answer echoes)", () => {
    expect(errors.filter((e) => e.rule === "explanation")).toEqual([]);
  });

  it("sign data is complete and well-formed", () => {
    expect(errors.filter((e) => e.rule === "sign-data")).toEqual([]);
  });

  it("every topic holds at least its minimum share of the bank", () => {
    // warnings would list thin topics; assert none are thin enough to warn
    expect(warnings.filter((w) => w.rule === "topic-balance")).toEqual([]);
    expect(Object.keys(stats.balance).sort()).toEqual(Object.keys(CATEGORIES).sort());
  });

  it("CLI exits 0 under --strict on the shipped content", () => {
    // end-to-end: the same command CI runs
    execFileSync("node", ["scripts/validate-content.mjs", "--strict"], { cwd: fileURLToPath(new URL("..", import.meta.url)) });
  });
});
