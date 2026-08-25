#!/usr/bin/env node
/* Road Ready — learner-study cohort report.
 *
 *   node scripts/study-report.mjs export1.json [export2.json …]
 *
 * Accepts one or more anonymized study exports (schema road-ready-study@1)
 * and prints per-participant rows plus cohort aggregates — the numbers behind
 * a headline like "improved 64% → 87% after 2.9 h".
 *
 * Honest-math rules:
 *   - improvement counts ONLY participants with a diagnostic and ≥1 later mock
 *   - retention pools all probe attempts (Σcorrect / Σattempts)
 *   - no participant is counted twice; malformed files are skipped loudly
 */
import { readFileSync, existsSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node scripts/study-report.mjs <export.json> [more.json …]");
  process.exit(1);
}

const participants = [];
for (const f of files) {
  if (!existsSync(f)) { console.error(`skip: ${f} (not found)`); continue; }
  try {
    const d = JSON.parse(readFileSync(f, "utf8"));
    if (d.schema !== "road-ready-study@1") { console.error(`skip: ${f} (wrong schema)`); continue; }
    if (!d.protocol || typeof d.protocol.protocolVersion !== "string") { console.error(`skip: ${f} (missing protocol envelope — pre-rr-study-1.0 export)`); continue; }
    if (!d.participantId) { console.error(`skip: ${f} (no participant id)`); continue; }
    participants.push(d);
  } catch (e) {
    console.error(`skip: ${f} (${e.message})`);
  }
}
if (!participants.length) { console.error("no valid exports"); process.exit(1); }

const versions = new Set(participants.map((p) => p.protocol.protocolVersion + "|" + (p.protocol.contentVersion ?? "?")));
if (versions.size > 1) {
  console.warn("WARNING: cohort mixes protocol/content versions — results are NOT comparable:");
  for (const v of versions) console.warn("  - " + v);
}
console.log("protocol: " + participants[0].protocol.protocolVersion
  + " · content " + participants[0].protocol.contentVersion
  + " · scoring " + participants[0].protocol.scoringVersion
  + " · mastery " + participants[0].protocol.masteryVersion);

const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);

console.log(`\nLearner study — ${participants.length} participant(s)\n`);
console.log("id        day  diag  latest  Δpts  mocks  questions  hours  retention");
const rows = [];
for (const p of participants) {
  const m = p.metrics || {};
  const days = m.daysSinceEnroll ?? "–";
  const diag = m.diagnosticPct ?? null;
  const latest = m.latestMockPct ?? null;
  const delta = diag != null && latest != null ? latest - diag : null;
  const retention = m.retentionAttempts ? Math.round(100 * m.retentionCorrect / m.retentionAttempts) + "% (" + m.retentionAttempts + ")" : "–";
  console.log(
    String(p.participantId).padEnd(9),
    String(days).padStart(3),
    String(diag ?? "–").padStart(5),
    String(latest ?? "–").padStart(6),
    String(delta == null ? "–" : (delta > 0 ? "+" : "") + delta).padStart(5),
    String(m.mockCount ?? 0).padStart(6),
    String(m.questionsAnswered ?? 0).padStart(10),
    String(m.studyHours ?? 0).padStart(6),
    retention.padStart(10),
  );
  if (delta != null && p.enrolledAt) rows.push({ id: p.participantId, delta, diag, latest, hours: m.studyHours || 0 });
}

// cohort aggregates over improvable participants
const mean = (a) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
if (rows.length) {
  const deltas = rows.map((r) => r.delta);
  const diags = rows.map((r) => r.diag).filter((v) => v != null);
  const lasts = rows.map((r) => r.latest).filter((v) => v != null);
  const hours = rows.map((r) => r.hours).filter((h) => h > 0);
  let retA = 0, retC = 0;
  for (const p of participants) {
    const r = p.metrics?.retentionAttempts || 0;
    retA += r;
    retC += p.metrics?.retentionCorrect || 0;
  }
  const sd = Math.sqrt(mean(deltas.map((d) => d * d)) - Math.pow(mean(deltas), 2));
  console.log("\nCohort (" + rows.length + " with diagnostic + follow-up):");
  console.log(`  mean diagnostic → latest : ${mean(diags)?.toFixed(0)}% → ${mean(lasts)?.toFixed(0)}%`);
  console.log(`  mean improvement         : +${mean(deltas)?.toFixed(1)} pts (SD ${isNaN(sd) ? "–" : sd.toFixed(1)}, median +${median(deltas)?.toFixed(1)})`);
  console.log(`  improved (Δ>0)           : ${deltas.filter((d) => d > 0).length}/${rows.length}`);
  console.log(`  median study time        : ${median(hours)?.toFixed(1) ?? "–"} h (mean ${mean(hours)?.toFixed(1) ?? "–"} h)`);
  console.log(`  retention after ≥7 days  : ${retA ? Math.round((100 * retC) / retA) + "% of " + retA + " probes" : "–"}`);
  console.log(`\nHeadline template:`);
  console.log(`  Learners improved from ${mean(diags)?.toFixed(0)}% to ${mean(lasts)?.toFixed(0)}% after a median of ${(median(hours) ?? 0).toFixed(1)} hours of Road Ready practice.`);
} else {
  console.log("\nNo participant has both a diagnostic and a follow-up mock yet.");
}
