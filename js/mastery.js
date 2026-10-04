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

/**
 * Plain-learner sentences for each state. The chips above stay compact, but
 * anything a learner READS uses these: technical terms are translated at the
 * presentation layer, never removed from the engine.
 */
const MASTERY_PLAIN = {
  unseen: "You have not met this one yet.",
  seen: "You have met this once — one look is not knowing it yet.",
  learning: "You are learning this one — it is coming, but it is not solid yet.",
  secure: "You know this rule and have proved it in different situations.",
  strong: "You know this rule well and can recall it quickly and reliably.",
  "needs-review": "You learned this before — it is due a quick look so it does not fade.",
  misconception: "You have made this same mistake more than once — worth sorting out properly.",
};

/** Minimum distinct questions of a concept answered right (wording transfer). */
const MIN_VARIANTS_STRONG = 3;
const MIN_VARIANTS_SECURE = 2;
/** Minimum distinct question FORMS answered right (transfer credit). */
const MIN_FORMS_SECURE = 2;
/** Separate days with a successful retrieval (repeated retrieval). */
const MIN_RETRIEVAL_DAYS = 2;

/**
 * Transfer credit must be bounded by what the bank can actually offer.
 *
 * The state gates above ask for several DISTINCT questions and several DISTINCT
 * forms. That instinct is right — five near-identical recalls should not earn
 * what recall + scenario + visual earns — but a flat count silently makes some
 * concepts unmasterable. A concept shipped as ONE question can never show 2
 * variants or 2 forms, so it is pinned at `learning` for good no matter how
 * well it is answered.
 *
 * This is not hypothetical in the Great Britain pack: 348 of its 359 concepts
 * ship exactly one question and 351 are confined to a single form. A learner
 * who answered every GB question correctly, five times across five days,
 * reached `secure` on 8 concepts and was still shown as "Learning" on the other
 * 351 — a map contradicting their real performance, with a permanent ceiling
 * baked into the app's main diagnostic surface.
 *
 * So each concept declares the transfer it COULD have shown, and each gate is
 * the lesser of "what mastery asks for" and "what the bank makes possible". A
 * single-question concept is not penalised for variants it has no way to
 * demonstrate — and is never awarded transfer it did not demonstrate either:
 * the signals it CAN show (repeated retrieval across separate days, accuracy,
 * fluency, no active misconception) must carry the state instead, and must be
 * met more strictly to compensate.
 */
function transferCeiling(conceptQuestions) {
  const qs = Array.isArray(conceptQuestions) ? conceptQuestions : [];
  const offered = qs.length;
  const offeredForms = new Set(qs.map((q) => q.form || "recall")).size;
  return {
    offered,
    offeredForms,
    // One question can demonstrate at most one distinct item and one form.
    variantsCapable: Math.max(1, offered),
    formsCapable: Math.max(1, offeredForms),
    // Transfer is only genuinely demonstrable when the bank offers it at all.
    canShowTransfer: offered >= MIN_VARIANTS_SECURE && offeredForms >= MIN_FORMS_SECURE,
  };
}

/** A gate never demands more distinct evidence than the bank can supply. */
function attainable(asked, capable) {
  return Math.max(1, Math.min(asked, capable));
}

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
      // Distinct DAYS with a correct retrieval. The stat now records the ISO
      // day of every correct answer (Core.noteRetrieval); before that only a
      // single `lastSeen` existed, so this could never exceed 1 and every
      // multi-day retention gate was permanently out of reach.
      if (Array.isArray(st.retrievalDays)) {
        for (const d of st.retrievalDays) rightDays.add(d);
      }
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

  // Transfer gates, bounded by what the bank offers for THIS concept. A
  // concept with a single question cannot demonstrate wording/form transfer,
  // so demanding it would cap the state permanently; instead the accuracy,
  // spaced-retention and fluency bars are raised so the state still has to be
  // earned on evidence the learner can actually produce.
  const cap = transferCeiling(qs);
  const variantsNeeded = cap.canShowTransfer ? MIN_VARIANTS_SECURE : 1;
  const variantsNeededStrong = cap.canShowTransfer ? MIN_VARIANTS_STRONG : 1;
  const formsNeeded = cap.canShowTransfer ? MIN_FORMS_SECURE : 1;
  const formsNeededStrong = cap.canShowTransfer ? 3 : 1;
  // Compensating strictness where transfer is unavailable: at least two
  // separate days of successful retrieval and a very high accuracy bar, so a
  // narrow concept cannot drift to Secure on one lucky session.
  const accSecure = cap.canShowTransfer ? 0.75 : 0.85;
  const accStrong = cap.canShowTransfer ? 0.9 : 0.95;
  const retrievalNeeded = cap.canShowTransfer ? MIN_RETRIEVAL_DAYS : MIN_RETRIEVAL_DAYS + 1;

  let state;
  if (ev.accuracy >= accStrong && ev.variants >= attainable(variantsNeededStrong, cap.variantsCapable) &&
      ev.forms >= attainable(formsNeededStrong, cap.formsCapable) &&
      ev.retrievalDays >= retrievalNeeded && freshEnough && clean && fluent && !activeMis) {
    state = "strong";
  } else if (ev.accuracy >= accSecure && ev.variants >= attainable(variantsNeeded, cap.variantsCapable) &&
             (ev.forms >= attainable(formsNeeded, cap.formsCapable)) && clean && freshEnough &&
             ev.retrievalDays >= MIN_RETRIEVAL_DAYS && !activeMis) {
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
    transfer: cap,
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
  MASTERY_ENGINE_VERSION, MASTERY_STATES, MASTERY_DISPLAY, MASTERY_PLAIN,
  MIN_VARIANTS_STRONG, MIN_VARIANTS_SECURE, MIN_FORMS_SECURE,
  transferCeiling, attainable,
  conceptEvidence, conceptState, conceptMap, stateRank, nextActionFor,
  masterySummary, masteryStatements,
};

if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyMastery;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyMastery = RoadReadyMastery;
