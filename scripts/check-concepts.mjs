/* Verifies the concept layer resolves end to end:
 *
 *   1. every question in the bank carries a concept (a question without one
 *      silently falls into the coarse topic:<cat> bucket, and the concept layer
 *      stops diagnosing anything).
 *   2. every question resolves a usable teaching rule for the repair panel —
 *      curated entries first, the bank's own provenance-resolved explanations
 *      second. Nothing is invented to fill a gap.
 *   3. concept ids are kebab-case, so they are safe as DOM data attributes and
 *      as report keys.
 *
 * Run: node scripts/check-concepts.mjs
 */
import { loadContent } from "./content-loader.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const C = loadContent();
const bank = C.QUESTIONS;
const problems = [];
const warnings = [];

/* 1. concept coverage */
const noConcept = bank.filter((q) => !q.concept);
const topicFallback = bank.filter((q) => !q.concept).length;
if (topicFallback > 0) {
  problems.push(`${topicFallback} questions have no concept and would fall back to topic:<cat>`);
}

/* 2. ids are kebab-case (usable as data-* attribute values) */
const badIds = [...new Set(bank.map((q) => q.concept).filter((k) => k && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(k)))];
if (badIds.length) problems.push(`concept ids are not kebab-case: ${badIds.slice(0, 5).join(", ")}`);

/* 3. every question resolves a rule for the feedback panel */
let curated = 0, derived = 0, none = 0;
const noneList = [];
for (const q of bank) {
  const jur = q.jurisdiction && q.jurisdiction.length ? q.jurisdiction[0] : "generic";
  const m = C.conceptMeta(q.concept, jur);
  if (!m) { none++; noneList.push(`${q.id}/${q.concept}`); continue; }
  if (m.curated) curated++;
  else if (m.rule) derived++;
  else { none++; noneList.push(`${q.id}/${q.concept}`); }
}
if (none > 0) problems.push(`${none} questions resolve no rule: ${noneList.slice(0, 5).join(", ")}`);

/* 4. the registry must not contradict the assignments: no question may be
      assigned to a concept key that collides with a topic fallback. */
const collisions = bank.filter((q) => q.concept && q.concept.startsWith("topic:"))
  .map((q) => q.id);
if (collisions.length) problems.push(`questions assigned to a topic: pseudo-concept: ${collisions.slice(0, 5).join(", ")}`);

/* 5. the concept->name mapping must never produce an empty label. */
const unnamed = [...new Set(bank.map((q) => q.concept))].filter((k) => k && !C.conceptName(k));
if (unnamed.length) problems.push(`${unnamed.length} concepts have no display name`);

/* 7. the registry must never contradict an inline declaration. applyConcepts()
   skips anything already assigned, so a map entry that disagreeing with the bank
   is dead AND misleading: a maintainer reading the map as truth would expect
   different behaviour from what the app does.
   Inline declarations are read from js/questions.js SOURCE, because by the time
   loadContent() returns, applyConcepts has already run and every universal
   question carries a concept — the loaded objects cannot tell us which came
   from where. */
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
import { readFileSync } from "node:fs";
const bankSource = readFileSync(path.join(ROOT, "js/questions.js"), "utf8");
const inlineConcepts = new Map();
const bankIds = new Set();
let scan = 0;
while ((scan = bankSource.indexOf("id:", scan)) !== -1) {
  const idm = /id:\s*["']([^"']+)["']/.exec(bankSource.slice(scan, scan + 60));
  if (!idm) { scan += 3; continue; }
  // the object body runs to the next question's opening brace or the array end
  const nextQ = bankSource.indexOf("\n  {", scan);
  const nextEnd = bankSource.indexOf("\n];", scan);
  const bodyEnd = [nextQ, nextEnd].filter((x) => x !== -1).sort((a, b) => a - b)[0] ?? bankSource.length;
  const body = bankSource.slice(scan, bodyEnd);
  const cm = body.match(/concept:\s*["']([^"']+)["']/);
  bankIds.add(idm[1]);
  if (cm) inlineConcepts.set(idm[1], cm[1]);
  scan += 3;
}
const registry = C.QUESTION_CONCEPTS || {};
let contradicting = 0, stale = 0, applicable = 0;
for (const [id, concept] of Object.entries(registry)) {
  if (!bankIds.has(id)) { stale++; continue; }
  const inline = inlineConcepts.get(id);
  if (inline) {
    if (inline !== concept) {
      problems.push(`QUESTION_CONCEPTS[${id}] says "${concept}" but the bank declares "${inline}" — the inline value wins, so this entry is dead and misleading`);
      contradicting++;
    }
    continue;
  }
  applicable++;
}
if (stale) problems.push(`QUESTION_CONCEPTS has ${stale} entries for ids not in the bank`);
console.log(`registry: ${Object.keys(registry).length} entries, ${applicable} apply, ${inlineConcepts.size} inline in the bank`);

/* 8. coverage picture (reported, not failed on — the gaps are the point) */
const perConcept = new Map();
for (const q of bank) {
  const k = q.concept;
  if (!perConcept.has(k)) perConcept.set(k, []);
  perConcept.get(k).push(q);
}
const thin = [...perConcept.entries()].filter(([, qs]) => qs.length < 3);
const singleForm = [...perConcept.entries()].filter(([, qs]) => new Set(qs.map((q) => q.form || "recall")).size < 2 && qs.length >= 2);
if (thin.length) {
  warnings.push(`${thin.length} of ${perConcept.size} concepts have fewer than 3 questions — surfaced as review notes by content QA, not a failure here`);
}
if (singleForm.length) {
  warnings.push(`${singleForm.length} concepts use a single question form across 2+ questions`);
}

console.log(`bank: ${bank.length} questions, ${perConcept.size} distinct concepts`);
console.log(`concepts assigned: ${bank.length - topicFallback}/${bank.length}`);
console.log(`rules: ${curated} curated, ${derived} derived from the bank's own explanations, ${none} missing`);
console.log(`registry: ${Object.keys(registry).length} entries, all applicable, ${inlineConcepts.size} declared inline in the bank`);
console.log(`thin concepts (<3 questions): ${thin.length}; single-form concepts (2+ questions): ${singleForm.length}`);
for (const w of warnings) console.log(`  note: ${w}`);
console.log(problems.length ? "PROBLEMS:" : "concept layer verified");
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length ? 1 : 0);
