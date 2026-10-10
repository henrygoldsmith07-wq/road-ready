/* Verifies the first-run coaching copy is truthful and that the existing path
   for learners with answers is unchanged. This is the check that would have
   caught the original bug, so it belongs in the repo rather than in a scratch
   file. */
import Explain from "../js/explain.js";
import { loadContent } from "./content-loader.mjs";

const C = loadContent();
const bank = C.QUESTIONS;

let fail = 0;
const problems = [];
const rec = (over = {}) => ({ type: "build-coverage", title: "t", detail: "d", questionCount: 12, minutes: 10, why: [], conceptKeys: [], issueKind: "coverage", evidence: [], ...over });

/* 1. FRESH learner: coverage 0. The word "performing well" must not appear. */
const fresh = Explain.explainRecommendation(rec(), { coverage: 0, untestedConcepts: 200, bankSize: bank.length, scopeLabel: "current" });
console.log("FRESH learner  ->", JSON.stringify(fresh.noticed));
if (!fresh.noticed) { problems.push("fresh learner produced no 'noticed' copy"); fail++; }
if (/performing well/i.test(fresh.noticed)) {
  problems.push("fresh learner (0 answered) is still told it is 'performing well'");
  fail++;
}
if (!/not answered anything yet|clean slate/i.test(fresh.noticed)) {
  problems.push("fresh copy does not say nothing has been answered yet");
  fail++;
}
if (/200 concept/.test(fresh.noticed)) {
  // good: it still reports the real gap
} else { problems.push("fresh copy dropped the untested-concept count"); fail++; }

/* 2. STARTED learner: coverage > 0. The claim is legitimate, so keep it. */
const started = Explain.explainRecommendation(rec(), { coverage: 0.34, untestedConcepts: 130, bankSize: bank.length, scopeLabel: "current" });
console.log("STARTED learner->", JSON.stringify(started.noticed));
if (!/performing well/.test(started.noticed)) {
  problems.push("a learner who has answered questions lost the legitimate 'performing well' copy");
  fail++;
}

/* 3. no untestedConcepts supplied -> the coverage-percentage fallback survives */
const noCount = Explain.explainRecommendation(rec(), { coverage: 0.34, untestedConcepts: null, bankSize: bank.length, scopeLabel: "current" });
console.log("NO COUNT       ->", JSON.stringify(noCount.noticed));
if (!/covered only 34%/.test(noCount.noticed)) { problems.push("coverage-percentage fallback broke"); fail++; }

/* 4. every other recommendation path still produces copy (no regressions) */
for (const type of ["fix-misconception", "review-overdue", "improve-fluency", "strengthen-weak-topic", "take-mock", "maintain-strong", "light-review"]) {
  const e = Explain.explainRecommendation(rec({ type }), { coverage: 0.5, bankSize: bank.length, conceptName: "Lane selection" });
  const missing = ["noticed", "matters", "doNow", "amount", "success"].filter((k) => !e[k]);
  if (missing.length) { problems.push(`${type} copy missing: ${missing.join(", ")}`); fail++; }
  else console.log(`${type.padEnd(22)} -> ok`);
}

/* 5. no copy anywhere may contain an unresolved template token */
for (const type of ["build-coverage", "fix-misconception", "review-overdue", "improve-fluency", "strengthen-weak-topic", "take-mock", "maintain-strong", "light-review"]) {
  const e = Explain.explainRecommendation(rec({ type, questionCount: 8, minutes: 7 }), {
    coverage: 0.4, bankSize: bank.length, conceptName: "Lane selection", untestedConcepts: 90,
    errors: 3, fastWrong: 1, overdue: 2, slowRight: 1, mastery: 0.4, encounters: 6, daysLeft: 12,
  });
  for (const [k, v] of Object.entries(e)) {
    if (typeof v === "string" && (/\$\{[A-Za-z_]/.test(v) || /\bundefined\b/.test(v) || /\bnull\b/.test(v) || /\bNaN\b/.test(v))) {
      problems.push(`${type}.${k} contains an unresolved token: ${v}`);
      fail++;
    }
  }
}

console.log(problems.length ? `\nPROBLEMS (${problems.length}):` : "\nall coaching-copy checks passed");
for (const p of problems) console.log(`  - ${p}`);
process.exit(fail ? 1 : 0);
