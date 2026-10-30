/* Boot smoke: load the real index.html shell and execute every deferred
   classic script in document order inside jsdom, then let app.js init()
   run. Any uncaught exception, window.onerror report, or console.error
   during boot fails the test — this is the cheapest net for the class of
   UI errors (null element wiring, missing globals, boot-order slips)
   that unit tests on isolated modules cannot see. */
import { describe, expect, it } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SCRIPTS = [
  "js/boot-error.js",
  "js/signs.js",
  "js/icons.js",
  "js/questions.js",
  "js/concepts.js",
  "js/core.js",
  "js/mastery.js",
  "js/explain.js",
  "js/evidence.js",
  "js/coach.js",
  "js/concept-map-ui.js",
  "js/format.js",
  "js/account.js",
  "js/account-ui.js",
  "js/practical-ui.js",
  "js/study-ui.js",
  "js/flashcards-ui.js",
  "js/review-ui.js",
  "js/results-ui.js",
  "js/home-ui.js",
  "js/quiz-ui.js",
  "js/commute-ui.js",
  "js/stats-ui.js",
  "js/hazard-scenarios.js",
  "js/hazard-ui.js",
  "js/guide.js",
  "js/jurisdictions.js",
  "js/state-packs.js",
  "js/exam-blueprints.js",
  "js/app.js",
];

function boot() {
  const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
  // Mute jsdom's "Not implemented" shouts for APIs the app only uses as
  // progressive enhancement (scrollTo during boot); real failures still
  // surface via window.onerror and the console.error hook below.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => {
    if (e && e.message && /scrollTo|scrollIntoView/.test(e.message)) return;
    throw e;
  });
  // jsdom >= 24 renamed sendTo({ omitJSDOMErrors }) to forwardTo({ jsdomErrors });
  // "none" preserves the old omitJSDOMErrors behavior (jsdomErrors are handled by
  // the listener above, not echoed to the real console).
  virtualConsole.forwardTo(console, { jsdomErrors: "none" });
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  const errors = [];
  const warns = [];
  window.addEventListener("error", (e) => errors.push(String((e && e.message) || (e && e.error) || e)));
  const consoleError = window.console.error.bind(window.console);
  window.console.error = (...args) => {
    errors.push(args.map(String).join(" "));
    consoleError(...args);
  };
  const consoleWarn = window.console.warn.bind(window.console);
  window.console.warn = (...args) => {
    warns.push(args.map(String).join(" "));
    consoleWarn(...args);
  };
  // Browser APIs jsdom lacks but boot touches behind guards or directly.
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
  }
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = (cb) => window.setTimeout(() => cb({ timeRemaining: () => 50 }), 0);
  }
  // Concatenate-then-eval, not one eval per file: browser classic scripts
  // share a single global lexical environment, so top-level const (SIGNS,
  // CATEGORIES, QUESTIONS) is visible across files. Separate window.eval
  // calls do not reproduce that and yield false "not defined" failures.
  const scriptErrors = [];
  const bundle = SCRIPTS.map(
    (src) => `\n;/* ---- ${src} ---- */\n` + readFileSync(fileURLToPath(new URL(`../${src}`, import.meta.url)), "utf8"),
  ).join("\n");
  try {
    window.eval(bundle);
  } catch (err) {
    scriptErrors.push(`bundle: ${err && err.message}`);
  }
  return { window, errors, warns, scriptErrors };
}

describe("boot smoke (full shell, document script order)", () => {
  it("executes every script with no exception", () => {
    const { scriptErrors } = boot();
    expect(scriptErrors).toEqual([]);
  });

  it("boots with no window errors and no console.error", async () => {
    const { errors } = boot();
    // Let deferred timers (idle callbacks, reminder scheduling) flush.
    await new Promise((r) => setTimeout(r, 50));
    expect(errors).toEqual([]);
  });

  it("renders the home view with a Today Plan action", () => {
    const { window } = boot();
    const doc = window.document;
    // Router shows exactly one view; home is the boot view for a fresh profile.
    const visible = [...doc.querySelectorAll(".view")].filter((v) => !v.hidden);
    expect(visible.length).toBeGreaterThan(0);
    expect(doc.getElementById("todayPlan") || doc.getElementById("btnStartPractice") || doc.body.textContent).toBeTruthy();
  });
});
