/* Road Ready — concept mastery engine (pure, DOM-free).
 *
 * "Answered correctly several times" is NOT mastery. A concept becomes
 * Secure or Strong only on multiple signals:
 *   accuracy            — how often the concept's questions are answered right
 *   recency             — was it retrieved recently, not just once long ago
 *   repeated retrieval  — several separate successful recalls, not one session
 *   wording transfer    — different questions of the concept answered right
 *   form transfer       — different QUESTION FORMS answered right (a learner
 *                         who nails five near-identical recall items earns less
 *                         than one who handles recall + scenario + visual)
 *   fluency             — rights that are also quick (effortful rights count less)
 *   misconception-free  — no active recurring misconception on the concept
 *   spaced retention    — a scheduled review that came due and was passed
 *
 * States (in order): unseen, seen, learning, secure, strong — plus two
 * overlays computed from live signals: "needs-review" (spaced review due) and
 * "misconception" (active recurring error). The overlay wins the display.
 *
 * Classic-script module: js/mastery.js after js/core.js.
 */
"use strict";

const MasteryCore = (typeof module !== "undefined" && module.exports)
  ? require("./core.js")
  : (typeof globalThis !== "undefined" ? globalThis.RoadReadyCore : null);

const MASTERY_ENGINE_VERSION = "mastery-v4-robustness";

const MASTERY_STATES = ["unseen", "seen", "learning", "secure", "strong"];
const MASTERY_DISPLAY = {
  unseen: "Unseen",
  seen: "Seen once",
  learning: "Learning",
  secure: "Secure",
  strong: "Strong",
  "needs-review": "Needs review",
  misconception: "Recurring misconception",
};

/** Minimum distinct questions of a concept answered right (wording transfer). */
const MIN_VARIANTS_STRONG = 3;
const MIN_VARIANTS_SECURE = 2;
/** Minimum distinct question FORMS answered right (transfer credit). */
const MIN_FORMS_SECURE = 2;
/** Separate days with a successful retrieval (repeated retrieval). */
const MIN_RETRIEVAL_DAYS = 2;

const DAY_MS = 86400000;

/**
 * Evidence for one concept. Pure: reads only the question stats the app
 * already stores. `nowMs` anchors recency and due-date logic.
 */
function conceptEvidence(conceptQuestions, qstats, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  const stats = qstats || {};
  let attempts = 0, correct = 0, wrong = 0, fastWrong = 0, slowRight = 0;
  const rightVariants = new Set();   // question ids answered right at least once
  const rightForms = new Set();      // question forms answered right at least once
  const rightDays = new Set();       // distinct days with a right answer
  let due = 0, overdue = 0, retentionPassed = 0;
  let lastSeen = 0, lastRight = 0, lastWrong = 0;
  const questionIds = [];

  for (const q of conceptQuestions || []) {
    questionIds.push(q.id);
    const st = stats[q.id];
    if (!st || !st.seen) continue;
    attempts += st.seen;
    correct += st.correct;
    wrong += st.wrong;
    fastWrong += st.fastWrong || 0;
    slowRight += st.slowRight || 0;
    lastSeen = Math.max(lastSeen, st.lastSeen || 0);
    if (st.lastWrong) lastWrong = Math.max(lastWrong, st.lastWrong);
    if (st.correct > 0) {
      rightVariants.add(q.id);
      rightForms.add(q.form || "recall");
      if (st.lastSeen) rightDays.add(new Date(st.lastSeen).toISOString().slice(0, 10));
      lastRight = Math.max(lastRight, st.lastSeen || 0);
    }
    // spaced retention evidence: a review that came due and then got a right
    // answer without an intervening error (sched.due in the past + clean history)
    const sched = st.sched;
    if (sched && sched.due && sched.due <= now && st.correct > st.wrong) retentionPassed++;
    const d = MasteryCore ? MasteryCore.schedDue(st, now) : null;
    if (d === "now" || d === "overdue") due++;
    if (d === "overdue") overdue++;
  }

  return {
    questionIds,
    attempts, correct, wrong,
    accuracy: attempts ? correct / attempts : 0,
    fastWrong, slowRight,
    variants: rightVariants.size,
    forms: rightForms.size,
    retrievalDays: rightDays.size,
    due, overdue, retentionPassed,
    lastSeen, lastRight, lastWrong,
    recencyDays: lastSeen ? Math.floor((now - lastSeen) / DAY_MS) : null,
  };
}

/**
 * Concept state from evidence + optional misconception entry.
 * Deterministic and conservative: the state never runs ahead of the evidence.
 */
function conceptState(questions, qstats, misconceptionEntry, nowMs) {
  const qs = Array.isArray(questions) ? questions : [];
  const ev = conceptEvidence(qs, qstats, nowMs);
  if (!ev.attempts) return { state: "unseen", display: "Unseen", evidence: ev, overlay: null };

  const activeMis = misconceptionEntry && !misconceptionEntry.repairedAt && misconceptionEntry.errors > 0;
  const overlay = activeMis ? "misconception"
    : ev.overdue > 0 ? "needs-review"
    : null;

  // evidence gates — each state requires the signal it is named for
  const freshEnough = ev.recencyDays == null || ev.recencyDays <= 21;
  const clean = ev.wrong === 0 || ev.accuracy >= 0.75;
  const fluent = ev.slowRight <= Math.max(1, Math.floor(ev.attempts / 4));
  const transfer = ev.variants >= MIN_VARIANTS_STRONG && ev.forms >= MIN_FORMS_SECURE;
  const retained = ev.retrievalDays >= MIN_RETRIEVAL_DAYS;

  let state;
  if (ev.accuracy >= 0.9 && ev.variants >= MIN_VARIANTS_STRONG && ev.forms >= 3 &&
      retained && freshEnough && clean && fluent && !activeMis) {
    state = "strong";
  } else if (ev.accuracy >= 0.75 && ev.variants >= MIN_VARIANTS_SECURE &&
             (ev.forms >= MIN_FORMS_SECURE || transfer) && clean && freshEnough && !activeMis) {
    state = "secure";
  } else if (ev.attempts >= 1 && ev.correct > 0) {
    state = "learning";
  } else {
    state = "seen";
  }

  return {
    state,
    display: MASTERY_DISPLAY[overlay || state],
    overlay,
    evidence: ev,
  };
}

/**
 * Concept map for one topic: every concept with its state, learner-friendly
 * detail and a recommended next action (as a small descriptor the coach UI
 * turns into a drill). Ordered weakest/most-pressing first.
 */
function conceptMap(topicQuestions, qstats, misconceptions, nowMs) {
  const groups = MasteryCore
    ? MasteryCore.groupByConcept(topicQuestions || [])
    : new Map((topicQuestions || []).map((q) => [q.concept || `topic:${q.cat}`, [q]]));
  const rows = [];
  for (const [key, qs] of groups) {
    const mis = (misconceptions || {})[key];
    const r = conceptState(qs, qstats, mis, nowMs);
    rows.push({
      key,
      // conceptLabel lives on the coach module (which owns copy); mastery
      // degrades to a plain humanised key when it is unavailable.
      label: (() => {
        const globalCoach = (typeof globalThis !== "undefined" && globalThis.RoadReadyCoach) || null;
        const fn = globalCoach && globalCoach.conceptLabel;
        return typeof fn === "function" ? fn(key) : String(key).replace(/^topic:/, "").replace(/-/g, " ");
      })(),
      state: r.overlay || r.state,
      baseState: r.state,
      display: r.display,
      questionCount: qs.length,
      evidence: r.evidence,
      misconception: mis && !mis.repairedAt ? mis : null,
      nextAction: nextActionFor(r, mis),
    });
  }
  return rows.sort((a, b) => (stateRank(a.state) - stateRank(b.state))
    || (a.evidence.accuracy - b.evidence.accuracy)
    || (a.key < b.key ? -1 : 1));
}

/** Most pressing first: recurring misconception > review due > weak < unseen < strong. */
function stateRank(s) {
  return { misconception: 0, "needs-review": 1, learning: 2, seen: 3, unseen: 4, secure: 5, strong: 6 }[s] ?? 3;
}

function nextActionFor(r, mis) {
  const ev = r.evidence;
  if (r.overlay === "misconception") return { kind: "repair", label: "Repair misconception" };
  if (r.overlay === "needs-review") return { kind: "review", label: `Review ${ev.overdue || ev.due} due question${(ev.overdue || ev.due) === 1 ? "" : "s"}` };
  if (r.state === "unseen") return { kind: "cover", label: "Introduce this concept" };
  if (r.state === "seen") return { kind: "build", label: "Answer more variations" };
  if (r.state === "learning") {
    if (ev.forms < MIN_FORMS_SECURE) return { kind: "transfer", label: "Try a different question style" };
    if (ev.slowRight >= 2) return { kind: "fluency", label: "Speed up retrieval" };
    return { kind: "build", label: "Answer more variations" };
  }
  if (r.state === "secure") {
    if (ev.variants < MIN_VARIANTS_STRONG) return { kind: "transfer", label: "Prove it on more variations" };
    return { kind: "maintain", label: "Spaced review will keep it" };
  }
  return { kind: "maintain", label: "Maintenance only" };
}

/**
 * Topic-level roll-up for the progress screen and coach: how many concepts
 * sit in each state. Plain statements, not a single vanity number.
 */
function masterySummary(topicRows) {
  const counts = { unseen: 0, seen: 0, learning: 0, secure: 0, strong: 0, "needs-review": 0, misconception: 0 };
  for (const r of topicRows || []) counts[r.state] = (counts[r.state] || 0) + 1;
  const total = (topicRows || []).length;
  return {
    total,
    counts,
    covered: total ? 1 - (counts.unseen / total) : 0,
    solid: counts.secure + counts.strong,
    fragile: counts.learning + counts.seen,
    statements: masteryStatements(counts, total),
  };
}

/** Learner-facing plain statements — no single artificial percentage. */
function masteryStatements(counts, total) {
  const out = [];
  const covered = total - counts.unseen;
  if (!total) return ["Study a few questions and your concept map will build itself."];
  if (counts.unseen === 0) out.push("Every concept in this area has been met at least once.");
  else out.push(`${counts.unseen} of ${total} concepts here are still untested.`);
  if (counts.misconception) out.push(`${counts.misconception} recurring misconception${counts.misconception === 1 ? "" : "s"} to repair.`);
  if (counts["needs-review"]) out.push(`${counts["needs-review"]} concept${counts["needs-review"] === 1 ? " is" : "s are"} due for review.`);
  if (counts.secure + counts.strong) out.push(`${counts.secure + counts.strong} concept${counts.secure + counts.strong === 1 ? " is" : "s are"} securely known.`);
  if (counts.learning) out.push(`${counts.learning} concept${counts.learning === 1 ? " is" : "s are"} still learning.`);
  if (covered === 0) out.length = 0, out.push("Nothing attempted here yet.");
  return out;
}

const RoadReadyMastery = {
  MASTERY_ENGINE_VERSION, MASTERY_STATES, MASTERY_DISPLAY,
  MIN_VARIANTS_STRONG, MIN_VARIANTS_SECURE, MIN_FORMS_SECURE,
  conceptEvidence, conceptState, conceptMap, stateRank, nextActionFor,
  masterySummary, masteryStatements,
};

if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyMastery;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyMastery = RoadReadyMastery;
