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

/* Every intervention Road Ready performs, so its effect can be measured.
   Privacy: only ids, scores, counts and timestamps — never question text,
   free-text notes, or anything account-like. */
const INTERVENTIONS = [
  "misconception-repair",   // wrong answer → structured repair on one concept
  "concept-drill",          // targeted drill on a weak concept
  "spaced-review",          // due/overdue retrieval practice
  "sign-comparison",        // side-by-side sign confusion drill
  "fluency-drill",          // slow-but-correct speed work
  "misconception-escalation", // repeated failure → comparison + escalation
  "post-mock-drill",        // targeted repair session after a mock
  "today-plan",             // any Today Plan recommendation
];
/* Minimum paired observations before a per-intervention measure is reported. */
const MIN_INTERVENTION_PAIRS = 4;

/**
 * Append one recommendation/intervention event. Events are append-only and
 * small; the list is capped so long-term use cannot bloat the save file.
 * `entry.intervention` names one of INTERVENTIONS; the rest is measurement
 * metadata (ids, counts, scores, timestamps only — never question text or
 * anything account-like).
 */
function recordRecommendation(events, entry, nowMs) {
  const list = Array.isArray(events) ? events.slice() : [];
  const e = entry || {};
  list.push({
    at: num(e.at, nowMs == null ? Date.now() : nowMs, 0, 8.64e15),
    // A session's start and its closing outcome share a sessionId so one
    // session is measured once and never double-counted.
    sessionId: typeof e.sessionId === "string" ? e.sessionId.slice(0, 32) : "",
    type: typeof e.type === "string" ? e.type.slice(0, 32) : "unknown",
    followed: e.followed === true,
    kind: typeof e.kind === "string" ? e.kind.slice(0, 16) : "practice", // practice | drill | review | mock | plan-display
    conceptKeys: Array.isArray(e.conceptKeys) ? e.conceptKeys.filter((k) => typeof k === "string").slice(0, 6) : [],
    // Intervention measurement metadata (optional, sanitized).
    intervention: INTERVENTIONS.includes(e.intervention) ? e.intervention : undefined,
    jurisdiction: typeof e.jurisdiction === "string" ? e.jurisdiction.slice(0, 8) : undefined,
    questionForm: typeof e.questionForm === "string" ? e.questionForm.slice(0, 20) : undefined,
    misconceptionType: typeof e.misconceptionType === "string" ? e.misconceptionType.slice(0, 24) : undefined,
    priorMasteryState: typeof e.priorMasteryState === "string" ? e.priorMasteryState.slice(0, 16) : undefined,
    priorLatency: e.priorLatency == null ? null : num(e.priorLatency, null, 0, 360000),
    subsequentAttempts: e.subsequentAttempts == null ? null : num(e.subsequentAttempts, null, 0, 1e6),
    subsequentLatency: e.subsequentLatency == null ? null : num(e.subsequentLatency, null, 0, 360000),
    retentionIntervalDays: e.retentionIntervalDays == null ? null : num(e.retentionIntervalDays, null, 0, 3650),
    misconceptionRecurred: e.misconceptionRecurred == null ? null : e.misconceptionRecurred === true,
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

  // 3. coach-selected vs self-directed practice. A pair only counts when BOTH
  //    accuracies were actually measured — treating a missing "before" as 0
  //    fabricated a positive delta for every session.
  const coachSessions = followed.filter((e) => e.during && e.before);
  const selfSessions = list.filter((e) => !e.followed && e.during && e.before);
  const lift = (arr) => {
    const paired = arr.filter((e) => e.during.accuracy != null && e.before.accuracy != null);
    return paired.length >= MIN_PAIRS
      ? {
          meanAccuracyDelta: round3(paired.reduce((t, e) => t + (e.during.accuracy - e.before.accuracy), 0) / paired.length),
          n: paired.length,
        }
      : { insufficient: true, n: paired.length, need: MIN_PAIRS };
  };
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

  // 5. misconception RECURRENCE: repair followed by the same case reopening.
  const repaired = list.filter((e) => e.intervention === "misconception-repair" || e.intervention === "misconception-escalation");
  const recurrenceEvents = repaired.filter((e) => e.misconceptionRecurred != null);
  const recurred = recurrenceEvents.filter((e) => e.misconceptionRecurred === true).length;
  const recurrence = recurrenceEvents.length >= MIN_RESOLUTIONS
    ? { rate: round3(recurred / recurrenceEvents.length), n: recurrenceEvents.length }
    : { insufficient: true, n: recurrenceEvents.length, need: MIN_RESOLUTIONS };

  // 6. delayed retention: interventions whose follow-up came days later.
  const delayed = list.filter((e) => e.retentionIntervalDays != null && e.after && e.after.accuracy != null);
  const delayedRetention = delayed.length >= MIN_PAIRS
    ? {
        rate: round3(delayed.filter((e) => e.after.accuracy >= 0.75).length / delayed.length),
        meanDays: round3(delayed.reduce((t, e) => t + e.retentionIntervalDays, 0) / delayed.length),
        n: delayed.length,
      }
    : { insufficient: true, n: delayed.length, need: MIN_PAIRS };

  // 7. form transfer: did follow-up performance hold when the question form
  //    changed? Paired events carrying a questionForm plus during/after.
  const formPaired = followed.filter((e) => e.questionForm && e.during && e.after && e.after.accuracy != null);
  const formTransfer = formPaired.length >= MIN_INTERVENTION_PAIRS
    ? {
        meanAfterAccuracy: round3(formPaired.reduce((t, e) => t + e.after.accuracy, 0) / formPaired.length),
        n: formPaired.length,
      }
    : { insufficient: true, n: formPaired.length, need: MIN_INTERVENTION_PAIRS };

  // 8. per-intervention effectiveness: before vs after, each scoped to its
  //    own minimum sample. Never ranked against each other below threshold.
  const byType = {};
  for (const type of INTERVENTIONS) {
    const rows = list.filter((e) => e.intervention === type && e.before && e.after
      && (e.before.accuracy != null || e.before.conceptMastery != null));
    const deltas = rows.map((e) => {
      const base = e.after.conceptMastery != null && e.before.conceptMastery != null
        ? e.after.conceptMastery - e.before.conceptMastery
        : e.after.accuracy != null && e.before.accuracy != null
          ? e.after.accuracy - e.before.accuracy : null;
      return base;
    }).filter((d) => d != null);
    byType[type] = deltas.length >= MIN_INTERVENTION_PAIRS
      ? { meanDelta: round3(deltas.reduce((t, d) => t + d, 0) / deltas.length), n: deltas.length }
      : { insufficient: true, n: deltas.length, need: MIN_INTERVENTION_PAIRS };
  }

  // 9. recommendation completion: of the plans shown, how many were started
  //    and how many were finished. `plan-display` events are the denominator —
  //    completion is a real ratio only when a shown-but-ignored plan can be
  //    counted, so a log with no display events reports insufficient evidence
  //    instead of a decorative 100%.
  const displays = list.filter((e) => e.kind === "plan-display");
  const started = new Set(followed.map((e) => e.sessionId || `${e.at}:${e.type}`));
  const finished = new Set(followed.filter((e) => e.during && e.after).map((e) => e.sessionId || `${e.at}:${e.type}`));
  const completion = displays.length
    ? {
        startedRate: round3(Math.min(1, started.size / displays.length)),
        finishedRate: round3(Math.min(1, finished.size / displays.length)),
        shown: displays.length,
        started: started.size,
        finished: finished.size,
        masteryChange: improvement,
      }
    : { insufficient: true, n: 0, need: 1, note: "no plan-display events recorded yet" };

  // 10. time-to-secure: how long after first contact a concept reached
  //     "secure", from priorMasteryState + timestamps. Needs several concepts.
  const secureTracks = [];
  const firstByConcept = new Map();
  for (const e of list) {
    for (const key of e.conceptKeys || []) {
      const first = firstByConcept.get(key);
      if (!first) { firstByConcept.set(key, e); continue; }
      if (e.priorMasteryState === "secure" || e.priorMasteryState === "strong") {
        secureTracks.push((e.at - first.at) / 86400000);
        firstByConcept.delete(key);
      }
    }
  }
  const timeToSecure = secureTracks.length >= 3
    ? {
        meanDays: round3(secureTracks.reduce((t, d) => t + d, 0) / secureTracks.length),
        n: secureTracks.length,
      }
    : { insufficient: true, n: secureTracks.length, need: 3 };

  return {
    version: EVIDENCE_VERSION,
    recorded: list.length,
    followedRate: list.length ? round3(followed.length / list.length) : null,
    improvement,
    misconceptionResolution: resolution,
    misconceptionRecurrence: recurrence,
    delayedRetention,
    formTransfer,
    interventions: byType,
    recommendationCompletion: completion,
    timeToSecure,
    coachSelectedLift: coachLift,
    selfDirectedLift: selfLift,
    retention,
    hazardTiming: o.hazardTiming || { insufficient: true, n: 0 },
    // The only claims the product may make from this report:
    statements: buildStatements({ improvement, resolution, coachLift, selfLift, retention, recurrence, delayedRetention }),
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
    // Correlational wording only: this compares measured pairs; it never
    // claims the recommendation strategy caused the difference.
    out.push(m.coachLift.meanAccuracyDelta > m.selfLift.meanAccuracyDelta
      ? "Sessions started from a recommendation have larger measured accuracy gains in this data than self-directed ones — a small sample, and not proof the recommendation caused it."
      : "Self-directed sessions are holding up well against recommendation-started ones in this data.");
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
