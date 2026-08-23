/* Loads Road Ready's classic-script data files into Node for tooling/tests. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadClassicScriptFrom(root, relPath, exportNames) {
  const src = readFileSync(path.join(root, relPath), "utf8");
  const fn = new Function(`${src}\n;return {${exportNames.map((n) => `${n}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(",")}};`);
  return fn();
}

export function loadContent(rootDir) {
  const root = rootDir || ROOT;
  const q = loadClassicScriptFrom(root, "js/questions.js", ["QUESTIONS", "CATEGORIES"]);
  const s = loadClassicScriptFrom(root, "js/signs.js", ["SIGNS"]);
  let p = {};
  try { p = loadClassicScriptFrom(root, "js/state-packs.js", ["STATE_PACKS", "SOURCE_REGISTRY", "UNIVERSAL_DEFAULTS", "CONCEPT_FACT_KEYS", "VERIFICATION_MAX_AGE_DAYS"]); } catch { /* packs optional */ }
  const packs = p.STATE_PACKS || {};
  const sources = p.SOURCE_REGISTRY || {};
  const baseQuestions = q.QUESTIONS || [];
  const packQuestions = Object.values(packs).flatMap((pack) => pack.questions || []);
  return {
    ROOT: root,
    BASE_QUESTIONS: baseQuestions,
    PACK_QUESTIONS: packQuestions,
    // the full bank the app assembles from: universal + every jurisdiction
    QUESTIONS: baseQuestions.concat(packQuestions),
    CATEGORIES: q.CATEGORIES,
    SIGNS: s.SIGNS,
    STATE_PACKS: packs,
    SOURCE_REGISTRY: sources,
    UNIVERSAL_DEFAULTS: p.UNIVERSAL_DEFAULTS || {},
    CONCEPT_FACT_KEYS: p.CONCEPT_FACT_KEYS || {},
    VERIFICATION_MAX_AGE_DAYS: p.VERIFICATION_MAX_AGE_DAYS ?? null,
  };
}

export default loadContent;
