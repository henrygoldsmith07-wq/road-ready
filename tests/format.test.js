/* js/format.js — escapeHTML is the only sanctioned way to interpolate
 * possibly-untrusted values (imports, sync, user typing) into innerHTML
 * strings, so its contract is worth pinning: every dangerous character is
 * escaped, non-strings never throw, and nothing valid is mangled.
 *
 * Entity names below are built by concatenation so this file never contains
 * them as literal text (some pipelines re-interpret markup entities). */
import { describe, it, expect } from "vitest";
import Format from "../js/format.js";

const AMP = "&" + "amp;";
const LT = "&" + "lt;";
const GT = "&" + "gt;";
const QUOT = "&" + "quo" + "t;";
const SQUOT = "&" + "#39;";

describe("escapeHTML", () => {
  it("escapes all markup-significant characters", () => {
    const input = '<img src=x onerror="alert(1)">&\'';
    const out = Format.escapeHTML(input);
    expect(out).toBe(LT + "img src=x onerror=" + QUOT + "alert(1)" + QUOT + GT + AMP + SQUOT);
    // The whole point: what comes back can never form a tag or attribute
    // boundary when interpolated into an HTML string.
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain('"');
  });

  it("leaves plain text untouched", () => {
    expect(Format.escapeHTML("Stop at the red light")).toBe("Stop at the red light");
    expect(Format.escapeHTML("")).toBe("");
  });

  it("escapes a bare ampersand into an entity", () => {
    expect(Format.escapeHTML("&")).toBe(AMP);
    expect(Format.escapeHTML("Q&A")).toBe("Q" + AMP + "A");
  });

  it("coerces non-strings without throwing (numbers, null, undefined)", () => {
    expect(Format.escapeHTML(5)).toBe("5");
    expect(Format.escapeHTML(null)).toBe("null");
    expect(Format.escapeHTML(undefined)).toBe("undefined");
  });

  it("escapes markup-significant characters arriving via non-strings", () => {
    // String(["<b>"]) is "<b>" — it must still come back escaped.
    expect(Format.escapeHTML(["<" + "b>"])).toBe(LT + "b" + GT);
  });

  it("escapes every occurrence, not just the first", () => {
    expect(Format.escapeHTML("<><>&&")).toBe(LT + GT + LT + GT + AMP + AMP);
  });
});
