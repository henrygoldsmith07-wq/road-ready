#!/usr/bin/env node
/* Road Ready — content coverage report (CLI).
 *
 *   node scripts/content-coverage.mjs [--write docs/CONTENT-INVENTORY.md]
 *
 * Regenerates the canonical content inventory from the canonical content
 * sources (js/questions.js, js/concepts.js, js/state-packs.js, js/packs/uk.js,
 * js/exam-blueprints.js, js/jurisdictions.js). No number in this repo's
 * documentation should be typed by hand: this script is the single place a
 * count comes from.
 *
 * Without --write it prints the report to stdout, so it can be read in review
 * without touching the tree.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent } from "./content-loader.mjs";
import { runChecks } from "./content-checks.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");

const C = loadContent();
const { QUESTIONS, CATEGORIES, STATE_PACKS, SOURCE_REGISTRY, EXAM_BLUEPRINTS, JURISDICTIONS } = C;
const { stats, warnings } = runChecks(C);

const conceptKey = (q) => (q && typeof q.concept === "string" && q.concept.trim())
  ? q.concept.trim()
  : `topic:${q && q.cat}`;

/* Concept groups are computed here rather than taken from runChecks(), so this
   report stays a pure function of the loaded content and cannot drift from a
   change in the QA module's return shape. Grouped at the level of the
   underlying rule, matching how mastery is measured. */
const conceptGroups = new Map();
for (const q of QUESTIONS) {
  const k = conceptKey(q);
  if (!conceptGroups.has(k)) conceptGroups.set(k, []);
  conceptGroups.get(k).push(q);
}
const conceptQuestions = [...conceptGroups.entries()].map(([key, qs]) => ({
  key,
  questions: qs,
  cat: qs[0].cat,
  jurisdictions: [...new Set(qs.flatMap((x) => (Array.isArray(x.jurisdiction) ? x.jurisdiction : [])))],
  forms: [...new Set(qs.map((x) => (x.form ? x.form : "recall")))],
}));

/* ---------------- roll-ups ---------------- */
const byJurisdiction = {};
const jurisdictionOf = (q) => {
  if (Array.isArray(q.jurisdiction) && q.jurisdiction.length) return q.jurisdiction[0];
  return q.cat; // never happens; defensive
};

// Universal bank = the US default bank, available to every US pack.
const universal = QUESTIONS.filter((q) => !Array.isArray(q.jurisdiction) || !q.jurisdiction.length);
const packQuestions = QUESTIONS.filter((q) => Array.isArray(q.jurisdiction) && q.jurisdiction.length);

byJurisdiction["generic (universal US bank)"] = {
  label: "General U.S. rules — no state pack selected",
  universal: universal.length,
  pack: 0,
  total: universal.length,
  regions: ["generic"],
};

for (const packId of Object.keys(STATE_PACKS)) {
  if (packId === "generic") continue;
  const qs = STATE_PACKS[packId].questions || [];
  byJurisdiction[packId] = {
    label: STATE_PACKS[packId].name || packId,
    universal: STATE_PACKS[packId].includeUniversal === false ? 0 : universal.length,
    pack: qs.length,
    total: (STATE_PACKS[packId].includeUniversal === false ? 0 : universal.length) + qs.length,
    regions: [packId],
  };
}

const topicRows = Object.entries(CATEGORIES).map(([id, cat]) => {
  const all = QUESTIONS.filter((q) => q.cat === id);
  const concepts = new Set(all.map(conceptKey));
  const withVariation = [...concepts].filter((k) => all.filter((q) => conceptKey(q) === k).length >= 2);
  const forms = new Set(all.map((q) => q.form || "recall"));
  return {
    id, name: cat.name, icon: cat.icon,
    questions: all.length,
    concepts: concepts.size,
    conceptsWithVariation: withVariation.length,
    forms: forms.size,
  };
});

const thinConcepts = conceptQuestions
  .filter((c) => c.questions.length < 3)
  .sort((a, b) => a.questions.length - b.questions.length || a.key.localeCompare(b.key));

const singleFormConcepts = conceptQuestions.filter((c) => c.forms.length < 2 && c.questions.length >= 2);
const formCounts = {};
for (const q of QUESTIONS) formCounts[q.form || "recall"] = (formCounts[q.form || "recall"] || 0) + 1;

const sourceRows = Object.entries(SOURCE_REGISTRY).map(([id, s]) => {
  const qs = QUESTIONS.filter((q) => q.sourceId === id).length;
  const viaDefault = QUESTIONS.filter((q) => !q.sourceId && (C.UNIVERSAL_DEFAULTS[q.cat] || {}).sourceId === id).length;
  return { id, agency: s.agency, title: s.title, jurisdiction: s.jurisdiction, verified: s.verified, url: s.url || null, questions: qs, viaDefault, citationLabel: s.citationLabel || "Official source" };
});

/* ---------------- report ---------------- */
const L = [];
L.push("# Road Ready content inventory");
L.push("");
L.push("> **Generated file — do not edit by hand.**");
L.push(">");
L.push("> Source: `scripts/content-coverage.mjs`, run against the canonical content");
L.push("> sources (`js/questions.js`, `js/concepts.js`, `js/state-packs.js`,");
L.push("> `js/packs/uk.js`, `js/exam-blueprints.js`, `js/jurisdictions.js`).");
L.push(">");
L.push("> Regenerate with `node scripts/content-coverage.mjs --write`.");
L.push("> Every count in `README.md` should trace back to this file.");
L.push("");
L.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
L.push("");

L.push("## Headline numbers");
L.push("");
L.push("| Measure | Value |");
L.push("|---|---|");
L.push(`| Questions in the full bank | ${QUESTIONS.length} |`);
L.push(`| Universal (US, no state pack) bank | ${universal.length} |`);
L.push(`| Jurisdiction-pack questions | ${packQuestions.length} |`);
L.push(`| Great Britain pack questions | ${(STATE_PACKS.UK.questions || []).length} |`);
L.push(`| U.S. state-pack questions (six states) | ${packQuestions.length - (STATE_PACKS.UK.questions || []).length} |`);
L.push(`| Distinct concepts | ${conceptQuestions.length} |`);
L.push(`| Concepts with 3+ questions | ${conceptQuestions.filter((c) => c.questions.length >= 3).length} |`);
L.push(`| Concepts with 2+ question forms | ${conceptQuestions.filter((c) => c.forms.length >= 2).length} |`);
L.push(`| Concepts with a single question | ${conceptQuestions.filter((c) => c.questions.length === 1).length} |`);
L.push(`| Distinct question forms | ${Object.keys(formCounts).length} |`);
L.push(`| Road signs with artwork | ${stats.signs} |`);
L.push(`| Registered jurisdictions (packs) | ${stats.packs} |`);
L.push("");

L.push("## What these numbers do and do not support");
L.push("");
L.push("The table below is the honest version of the product's coverage claim.");
L.push("");
L.push("| Jurisdiction | Universal bank | Own pack questions | Total available | Unique questions for an official-length mock | Own-pack depth vs a full exam |");
L.push("|---|---|---|---|---|---|");
for (const [packId, row] of Object.entries(byJurisdiction)) {
  const bp = EXAM_BLUEPRINTS[packId];
  const enough = bp
    ? (row.total >= bp.questionCount ? `yes - ${row.total} available, ${bp.questionCount} needed` : `**no - only ${row.total} of ${bp.questionCount}**`)
    : "n/a (no published exam spec)";
  const depth = bp
    ? (row.pack >= bp.questionCount
      ? `${row.pack} own questions (${(100 * row.pack / bp.questionCount).toFixed(0)}% of a full exam's worth)`
      : `**${row.pack} own questions - ${(100 * row.pack / bp.questionCount).toFixed(0)}% of a full exam's worth (${bp.questionCount} needed)**`)
    : "n/a";
  L.push(`| ${row.label} | ${row.universal} | ${row.pack} | ${row.total} | ${enough} | ${depth} |`);
}
L.push("");
L.push("Read the last two columns together, because they answer different questions.");
L.push("");
L.push("- **Unique questions for an official-length mock** is what the app can actually");
L.push("  assemble (`Core.officialExamAvailability`): the universal bank plus the state's");
L.push("  own questions, counted without repeats. This is why every U.S. state can still");
L.push("  run a full-length locked simulation.");
L.push("- **Own-pack depth** is the honest measure of *state-specific* preparation.");
L.push("  It counts only the questions whose answers are specific to that state. A");
L.push("  learner who only ever sees the universal bank has learned general U.S. rules and");
L.push("  nothing about that state's own limits, distances and penalties.");
L.push("");
L.push("Neither column says anything about how well the bank represents a real exam's");
L.push("topic mix: the blueprint's `topicWeights` are editorial approximations");
L.push("(`js/exam-blueprints.js`), and states do not publish numeric topic breakdowns.");
L.push("");

L.push("## Coverage by topic");
L.push("");
L.push("| Topic | Questions | Concepts | Concepts with 2+ questions | Question forms |");
L.push("|---|---|---|---|---|");
for (const t of topicRows.sort((a, b) => b.questions - a.questions)) {
  L.push(`| ${t.name} | ${t.questions} | ${t.concepts} | ${t.conceptsWithVariation} | ${t.forms} |`);
}
L.push("");
L.push("A high concept count with a low \"concepts with variation\" number means the");
L.push("topic is broad but shallow: each rule is tested by one question, so a right");
L.push("answer is evidence about one question, not about the rule.");
L.push("");

L.push("## Question-form distribution");
L.push("");
L.push("| Form | Questions | Share |");
L.push("|---|---|---|");
for (const [form, n] of Object.entries(formCounts).sort((a, b) => b[1] - a[1])) {
  L.push(`| ${form} | ${n} | ${((100 * n) / QUESTIONS.length).toFixed(1)}% |`);
}
L.push("");
L.push(`Recall and scenario forms dominate. ${thinConcepts.length} concepts have fewer than`);
L.push("three questions, which limits how well the app can verify that a learner can");
L.push("apply a rule to an unfamiliar situation rather than recognise a familiar");
L.push("prompt.");
L.push("");

L.push("## Concepts that cannot yet evidence transfer");
L.push("");
L.push("Listed so the gap is visible in review rather than hidden inside a topic total.");
L.push("Batch 1 of the content plan targets the concepts a learner is most likely to");
L.push("meet first; this list is the work queue, in priority order.");
L.push("");
L.push("| Concept | Questions | Forms | Topic |");
L.push("|---|---|---|---|");
for (const c of thinConcepts.slice(0, 120)) {
  L.push(`| \`${c.key}\` | ${c.questions.length} | ${c.forms.join(", ")} | ${c.questions[0].cat} |`);
}
L.push("");
if (thinConcepts.length > 120) L.push(`and ${thinConcepts.length - 120} more. See \`node scripts/validate-content.mjs\` for the full list.`);
L.push("");

L.push("## Source provenance");
L.push("");
L.push("Every question resolves to one of these registered sources. Direct agency");
L.push("sources are labelled **Official source** in the app; the multi-handbook U.S.");
L.push("composite is labelled **Reference basis**, because it is not a single official");
L.push("document.");
L.push("");
L.push("| Source | Authority | Jurisdiction | Verified | Questions citing it directly | Via category default |");
L.push("|---|---|---|---|---|---|");
for (const s of sourceRows) {
  L.push(`| ${s.id} | ${s.agency} | ${s.jurisdiction} | ${s.verified} | ${s.questions} | ${s.viaDefault} |`);
}
L.push("");
L.push("A source older than `VERIFICATION_MAX_AGE_DAYS` (365) fails content QA");
L.push("(`scripts/content-checks.mjs`, rule `provenance-stale`), so the table above");
L.push("cannot silently go stale.");
L.push("");

const reviewNotes = warnings.filter((w) => w.review);
L.push("## Open review notes from content QA");
L.push("");
L.push(`${reviewNotes.length} advisory notes, grouped by rule. These are surfaced, never`);
L.push("silently dropped, and none of them fail the build on their own.");
L.push("");
const byRule = {};
for (const w of reviewNotes) (byRule[w.rule] ||= []).push(w.msg);
for (const [rule, msgs] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
  L.push(`### ${rule} — ${msgs.length}`);
  L.push("");
  for (const m of msgs.slice(0, 15)) L.push(`- ${m}`);
  if (msgs.length > 15) L.push(`- and ${msgs.length - 15} more`);
  L.push("");
}

L.push("## Reproducing this file");
L.push("");
L.push("```bash");
L.push("node scripts/validate-content.mjs --strict   # content QA, must pass");
L.push("node scripts/content-coverage.mjs --write    # regenerate this file");
L.push("node scripts/content-coverage.mjs --check    # CI: fail if it is out of date");
L.push("```");
L.push("");

const report = L.join("\n");

const OUT_REL = path.join("docs", "CONTENT-INVENTORY.md");

if (CHECK) {
  /* CI mode. Compares the committed file against what the canonical sources
     would produce. The date line is excluded, because it changes every day and
     a stale date is not a stale count; the counts themselves are the contract. */
  let committed = "";
  try {
    committed = readFileSync(path.join(ROOT, OUT_REL), "utf8");
  } catch {
    console.error(`content-coverage: ${OUT_REL} is missing — run "npm run content:coverage:write"`);
    process.exit(1);
  }
  const strip = (s) => s.split("\n").filter((l) => !l.startsWith("**Generated:**")).join("\n").trim();
  const a = strip(committed).replace(/\r\n/g, "\n");
  const b = strip(report).replace(/\r\n/g, "\n");
  if (a === b) {
    console.log(`content-coverage: ${OUT_REL} is up to date (${QUESTIONS.length} questions, ${conceptQuestions.length} concepts)`);
  } else {
    const diffLine = (() => {
      const A = a.split("\n"), B = b.split("\n");
      for (let i = 0; i < Math.max(A.length, B.length); i++) {
        if (A[i] !== B[i]) return `line ${i + 1}: committed "${A[i]}" vs generated "${B[i]}"`;
      }
      return "";
    })();
    console.error(`content-coverage: ${OUT_REL} is STALE — run "npm run content:coverage:write"`);
    console.error(`  first divergence — ${diffLine}`);
    process.exit(1);
  }
} else if (WRITE) {
  const out = path.join(ROOT, OUT_REL);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, report);
  console.log(`content-coverage: wrote ${path.relative(ROOT, out)} (${report.length} bytes, ${QUESTIONS.length} questions, ${conceptQuestions.length} concepts)`);
} else {
  console.log(report);
}
