// ESLint flat config — pragmatic rules for a zero-build vanilla JS app.
// Classic scripts share a global lexical scope, so cross-file identifiers
// (icon, QUESTIONS, SIGNS, …) are declared as globals instead of imports.
import js from "@eslint/js";

const browserGlobals = {
  window: "readonly", document: "readonly", localStorage: "readonly", navigator: "readonly",
  location: "readonly", fetch: "readonly", URL: "readonly",
  Blob: "readonly", FileReader: "readonly", confirm: "readonly", alert: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  speechSynthesis: "readonly", SpeechSynthesisUtterance: "readonly",
  performance: "readonly", console: "readonly",
};

// identifiers defined across our own classic scripts (loaded in order)
const sharedScriptGlobals = {
  QUESTIONS: "readonly", CATEGORIES: "readonly", SIGNS: "readonly",
  STATE_PACKS: "readonly", SOURCE_REGISTRY: "readonly", UNIVERSAL_DEFAULTS: "readonly",
  CONCEPT_FACT_KEYS: "readonly", VERIFICATION_MAX_AGE_DAYS: "readonly",
  EXAM_BLUEPRINTS: "readonly", JURISDICTIONS: "readonly", ACTIVE_COUNTRY: "readonly",
  RoadReadyCore: "readonly", RoadReadyPacks: "readonly", RoadReadyBlueprints: "readonly", RoadReadyJurisdictions: "readonly",
  module: "readonly",
  icon: "writable", signSVG: "readonly", hydrateIcons: "readonly",
};

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: { globals: { ...browserGlobals, ...sharedScriptGlobals } },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["sw.js"],
    languageOptions: { globals: { ...browserGlobals, self: "writable", caches: "readonly", clients: "readonly", skipWaiting: "readonly" } },
    rules: { "no-unused-vars": ["warn", { args: "none" }], "no-empty": "off" },
  },
  {
    files: ["serve.js"],
    languageOptions: { globals: { require: "readonly", __dirname: "readonly", http: "writable", fs: "writable", path: "writable", console: "readonly" } },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.{js,mjs}", "e2e/**/*.js", "*.config.mjs", "vitest.config.js", "playwright.config.js"],
    languageOptions: {
      globals: {
        console: "readonly", process: "readonly", URL: "readonly", Buffer: "readonly",
        localStorage: "readonly", navigator: "readonly", document: "readonly", window: "readonly",
        fetch: "readonly",
      },
    },
    rules: { "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] },
  },
];
