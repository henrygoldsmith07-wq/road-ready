/* Product-surface regression checks.
 *
 * Each check below corresponds to a defect that was found by auditing the
 * shipped product rather than by reading a spec. They are collected here so the
 * fixes stay fixed and so a re-introduction fails loudly.
 *
 *   1. First-run coaching copy must not claim the learner is "performing well"
 *      when they have answered nothing. The product's whole value is that it
 *      does not assert more than the evidence supports.
 *   2. A fresh install must not log a state-migration warning.
 *   3. The home screen must not bury its primary action: for a learner with no
 *      history the topic grid, which duplicates the Practice screen, must be
 *      collapsed and the empty stat strip hidden.
 *   4. Coaching copy must never emit an unresolved template token.
 *
 * Run: node scripts/check-product.mjs
 */
import fs from "node:fs";
import Core from "../js/core.js";
import Coach from "../js/coach.js";
import Explain from "../js/explain.js";
import { loadContent } from "./content-loader.mjs";

const C = loadContent();
const bank = C.QUESTIONS;
const NOW = 1750000000000;
const problems = [];

/* ---------- 1. first-run copy is truthful ---------- */
const freshRec = { type: "build-coverage", title: "t", detail: "d", questionCount: 12, minutes: 10, why: [], conceptKeys: [], issueKind: "coverage", evidence: [] };
const fresh = Explain.explainRecommendation(freshRec, { coverage: 0, untestedConcepts: 200, bankSize: bank.length, scopeLabel: "current" });
if (/performing well/i.test(fresh.noticed || "")) {
  problems.push("a learner with zero answers is still told they are 'performing well'");
}
if (!/not answered anything yet|clean slate/i.test(fresh.noticed || "")) {
  problems.push(`first-run copy does not state that nothing has been answered: "${fresh.noticed}"`);
}
const started = Explain.explainRecommendation(freshRec, { coverage: 0.34, untestedConcepts: 130, bankSize: bank.length, scopeLabel: "current" });
if (!/performing well/.test(started.noticed || "")) {
  problems.push("a learner with history lost the legitimate 'performing well' copy");
}

/* ---------- 2. a fresh install is silent ---------- */
for (const empty of [undefined, null]) {
  const w = Core.migrateState(empty, {}).warnings;
  if (w.length) problems.push(`migrateState(${String(empty)}) reports ${JSON.stringify(w)} on a first run`);
}
if (!Core.migrateState("[1,2,3]", {}).warnings.includes("invalid-payload")) {
  problems.push("a genuinely invalid payload no longer raises 'invalid-payload'");
}
if (!Core.migrateState("{not json", {}).warnings.includes("corrupt-json")) {
  problems.push("corrupt JSON no longer raises 'corrupt-json'");
}

/* ---------- 3. the home surface keeps the primary action reachable ---------- */
const html = fs.readFileSync("index.html", "utf8");
const homeStart = html.indexOf('<section class="view" id="view-home">');
const homeEnd = html.indexOf("<section", homeStart + 10);
const home = html.slice(homeStart, homeEnd === -1 ? undefined : homeEnd);
const gridIdx = home.indexOf('id="topicGrid"');
const planIdx = home.indexOf('id="todayPlanCard"');
if (planIdx === -1) problems.push("the home view has no Today's plan card");
if (gridIdx !== -1 && planIdx > gridIdx) {
  problems.push("the topic grid renders before the Today's plan card");
}
/* the grid must live inside a <details> so it cannot bury the plan */
if (gridIdx !== -1) {
  const before = home.slice(0, gridIdx);
  const opens = (before.match(/<details[^>]*>/g) || []).length;
  const closes = (before.match(/<\/details>/g) || []).length;
  if (opens <= closes) {
    problems.push("the topic grid is not inside a collapsed <details> — it renders inline and buries the primary action");
  }
}
/* the empty stat strip must be hidden by default, not filled with zeros */
const stripMatch = home.match(/id="statStrip"([^>]*)>/);
if (!stripMatch) problems.push("no #statStrip on the home view");
else if (!/\bhidden\b/.test(stripMatch[1])) {
  problems.push("#statStrip does not start hidden — a fresh account shows '0 / – / 0 / –'");
}
/* no recommendation path may emit an unresolved token ---------- */
for (const type of Coach.REC_TYPES ? Object.values(Coach.REC_TYPES) : []) {
  const e = Explain.explainRecommendation(
    { type, title: "t", detail: "d", questionCount: 8, minutes: 7, why: [], conceptKeys: [], issueKind: "coverage", evidence: [] },
    { coverage: 0.4, bankSize: bank.length, conceptName: "Lane selection", untestedConcepts: 90, errors: 3, fastWrong: 1, overdue: 2, slowRight: 1, mastery: 0.4, encounters: 6, daysLeft: 12 }
  );
  for (const [k, v] of Object.entries(e)) {
    if (typeof v === "string" && (/\$\{[A-Za-z_(]/.test(v) || /\b(undefined|NaN)\b/.test(v))) {
      problems.push(`${type}.${k} contains an unresolved token: ${v}`);
    }
  }
}

/* ---------- report ---------- */
console.log(`bank: ${bank.length} questions, ${C.CATEGORIES ? Object.keys(C.CATEGORIES).length : "?"} topics`);
console.log(`fresh copy: "${fresh.noticed}"`);
console.log(`started copy: "${started.noticed}"`);
console.log(`first-run warnings: ${JSON.stringify(Core.migrateState(undefined, {}).warnings)}`);
console.log(`home markup: plan card at ${planIdx}, grid at ${gridIdx}`);
console.log(problems.length ? `\nPROBLEMS (${problems.length}):` : "\nproduct-surface checks passed");
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length ? 1 : 0);
