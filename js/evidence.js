/* Road Ready — learning-evidence module (pure, DOM-free).
 *
 * Road Ready claims to make learners better. This module measures whether it
 * does — locally, honestly, and without claiming more than the data shows.
 *
 * For every Coach recommendation we record:
 *   - recommendation type
 *   - whether the learner followed it (a session started from the plan)
 *   - performance before (the evidence that triggered it)
 *   - performance during (the drill/session answers)
 *   - performance afterwards (the next snapshot on the same signals)
 *
 * Derived measures (each scoped so small samples report "insufficient"
 * instead of a number):
 *   - misconception resolution rate
 *   - concept retention after 1/3/7/14 days
 *   - mock improvement after targeted drills
 *   - Coach-selected practice effectiveness vs self-directed practice
 *   - performance after spaced review
 *   - hazard timing improvement
 *
 * NOTHING here may be presented as evidence that one strategy beats another
 * until enough paired observations exist. The report says "insufficient
 * evidence" freely — that is the honest default.
 */
"use strict";

const EVIDENCE_VERSION = "evidence-1";
const MIN_PAIRS = 8;        // before/after pairs needed to say anything
const MIN_RESOLUTIONS = 5;  // misconception cases needed for a rate
const RETENTION_DAYS = [1, 3, 7, 14];

/**
 * Append one recommendation event. Events are append-only and small; the
 * list is capped so long-term use cannot bloat the save file.
 */
function recordRecommendation(events, entry, nowMs) {
  const list = Array.isArray(events) ? events.slice() : [];
  const e = entry || {};
  list.push({
    at: num(e.at, nowMs == null ? Date.now() : nowMs, 0, 8.64e15),
    type: typeof e.type === "string" ? e.type.slice(0, 32) : "unknown",
    followed: e.followed === true,
    kind: typeof e.kind === "string" ? e.kind.slice(0, 16) : "practice", // practice | drill | review | mock
    conceptKeys: Array.isArray(e.conceptKeys) ? e.conceptKeys.filter((k) => typeof k === "string").slice(0, 6) : [],
    before: metricBlock(e.before),
    during: metricBlock(e.during),
    after: metricBlock(e.after),
  });
  return list.slice(-200);
}

function metricBlock(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  return {
    accuracy: m.accuracy == null ? null : num(m.accuracy, 0, 0, 1),
    conceptMastery: m.conceptMastery == null ? null : num(m.conceptMastery, 0, 0, 1),
    misconceptions: m.misconceptions == null ? null : num(m.misconceptions, 0, 0, 1e6),
    overdue: m.overdue == null ? null : num(m.overdue, 0, 0, 1e6),
    coveragePct: m.coveragePct == null ? null : num(m.coveragePct, 0, 0, 100),
  };
}

const num = (v, fallback, min, max) => {
  const n = typeof v === "number" && isFinite(v) ? v : parseFloat(v);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/**
 * Internal evaluation report. Every measure either reports a number with its
 * sample size, or says "insufficient evidence" — never a claim the data
 * cannot carry.
 */
function evaluate(events, opts) {
  const list = Array.isArray(events) ? events.filter((e) => e && typeof e === "object") : [];
  const o = opts || {};
  const followed = list.filter((e) => e.followed);
  const paired = followed.filter((e) => e.before && e.after);

  // 1. did performance move after followed recommendations?
  const moves = paired.map((e) => ({
    dMastery: e.after.conceptMastery != null && e.before.conceptMastery != null
      ? e.after.conceptMastery - e.before.conceptMastery : null,
    dMis: e.after.misconceptions != null && e.before.misconceptions != null
      ? e.before.misconceptions - e.after.misconceptions : null,
  })).filter((m) => m.dMastery != null || m.dMis != null);
  const masteryMoves = moves.filter((m) => m.dMastery != null);
  const improvement = masteryMoves.length >= MIN_PAIRS
    ? {
        meanMasteryDelta: round3(masteryMoves.reduce((t, m) => t + m.dMastery, 0) / masteryMoves.length),
        n: masteryMoves.length,
      }
    : { insufficient: true, n: masteryMoves.length, need: MIN_PAIRS };

  // 2. misconception resolution rate
  const misEvents = list.filter((e) => e.type === "fix-misconception" && e.before && e.after
    && e.before.misconceptions != null && e.after.misconceptions != null);
  const resolved = misEvents.filter((e) => e.after.misconceptions < e.before.misconceptions).length;
  const resolution = misEvents.length >= MIN_RESOLUTIONS
    ? { rate: round3(resolved / misEvents.length), n: misEvents.length }
    : { insufficient: true, n: misEvents.length, need: MIN_RESOLUTIONS };

  // 3. coach-selected vs self-directed practice
  const coachSessions = followed.filter((e) => e.during && e.before);
  const selfSessions = list.filter((e) => !e.followed && e.during && e.before);
  const lift = (arr) => (arr.length >= MIN_PAIRS
    ? {
        meanAccuracyDelta: round3(arr.reduce((t, e) => t + ((e.during.accuracy || 0) - (e.before.accuracy || 0)), 0) / arr.length),
        n: arr.length,
      }
    : { insufficient: true, n: arr.length, need: MIN_PAIRS });
  const coachLift = lift(coachSessions);
  const selfLift = lift(selfSessions);

  // 4. retention probes (from opts.retentionLog: [{askedAt, right}])
  const retention = {};
  const rlog = Array.isArray(o.retentionLog) ? o.retentionLog : [];
  for (const d of RETENTION_DAYS) {
    const inWindow = rlog.filter((r) => r && typeof r.askedAt === "number"
      && Math.abs(Math.floor((o.nowMs == null ? Date.now() : o.nowMs) - r.askedAt) / 86400000 - d) < 1);
    retention[d] = inWindow.length >= 3
      ? { rate: round3(inWindow.filter((r) => r.right).length / inWindow.length), n: inWindow.length }
      : { insufficient: true, n: inWindow.length };
  }

  return {
    version: EVIDENCE_VERSION,
    recorded: list.length,
    followedRate: list.length ? round3(followed.length / list.length) : null,
    improvement,
    misconceptionResolution: resolution,
    coachSelectedLift: coachLift,
    selfDirectedLift: selfLift,
    retention,
    hazardTiming: o.hazardTiming || { insufficient: true, n: 0 },
    // The only claims the product may make from this report:
    statements: buildStatements({ improvement, resolution, coachLift, selfLift, retention }),
  };
}

function buildStatements(m) {
  const out = [];
  if (m.improvement && !m.improvement.insufficient) {
    out.push(m.improvement.meanMasteryDelta > 0
      ? `Concept mastery improved after followed recommendations (+${m.improvement.meanMasteryDelta.toFixed(2)} average across ${m.improvement.n} sessions).`
      : `Followed recommendations have not moved concept mastery yet (${m.improvement.n} sessions measured).`);
  } else {
    out.push("Not enough followed sessions yet to measure whether recommendations move mastery.");
  }
  if (m.resolution && !m.resolution.insufficient) {
    out.push(`${Math.round(m.resolution.rate * 100)}% of tracked misconceptions were resolved after repair work (${m.resolution.n} cases).`);
  } else {
    out.push("Not enough misconception cases yet to report a resolution rate.");
  }
  if (m.coachLift && !m.coachLift.insufficient && m.selfLift && !m.selfLift.insufficient) {
    out.push(m.coachLift.meanAccuracyDelta > m.selfLift.meanAccuracyDelta
      ? "Coach-selected practice is producing larger accuracy gains than self-directed practice in this data — still a small sample."
      : "Self-directed practice is holding up well against Coach-selected practice in this data.");
  }
  return out;
}

const round3 = (x) => Math.round(x * 1000) / 1000;

const RoadReadyEvidence = {
  EVIDENCE_VERSION, MIN_PAIRS, RETENTION_DAYS,
  recordRecommendation, evaluate,
};

if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyEvidence;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyEvidence = RoadReadyEvidence;
