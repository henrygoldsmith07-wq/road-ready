/* Road Ready — Adaptive Coach engine (pure, DOM-free).
 *
 * The coach turns learner data Road Ready already collects into ONE ranked,
 * specific next action: what to practise, why, how much, which misconception
 * or weak concept is behind it, whether the issue is knowledge, retention,
 * fluency or coverage — and what changed since the previous session.
 *
 * Design rules (product):
 *  - Deterministic and testable: no randomness, explicit sort keys, explicit
 *    priority table. Same inputs → same plan, always.
 *  - A small number of recommendation TYPES, each with a concrete drill,
 *    never "practise road signs".
 *  - Honest language: recommendations cite measured evidence; where the
 *    evidence cannot distinguish causes the copy says "you may be mixing up"
 *    rather than asserting a psychological explanation.
 *  - The recommendation feeds the Today Plan card (the home screen's single
 *    primary action). No competing dashboard.
 *
 * Classic-script module: evaluated after core.js, which it reads through the
 * same dual node/browser resolution as js/state-packs.js.
 */
"use strict";

const CoachCore = (typeof module !== "undefined" && module.exports)
  ? require("./core.js")
  : (typeof globalThis !== "undefined" ? globalThis.RoadReadyCore : null);

const COACH_VERSION = "coach-1";

/* ---------------- recommendation types ---------------- */
/* A deliberately small set. Adding a type here is a product decision. */
const REC_TYPES = {
  FIX_MISCONCEPTION: "fix-misconception",
  REVIEW_OVERDUE: "review-overdue",
  BUILD_COVERAGE: "build-coverage",
  IMPROVE_FLUENCY: "improve-fluency",
  STRENGTHEN_WEAK_TOPIC: "strengthen-weak-topic",
  TAKE_MOCK: "take-mock",
  MAINTAIN_STRONG: "maintain-strong",
  LIGHT_REVIEW: "light-review",
};

const ISSUE_KINDS = ["misconception", "knowledge", "retention", "fluency", "coverage", "stable"];

/* ---------------- small pure helpers ---------------- */

/** "roundabout-priority" → "Roundabout priority"; "topic:signs" → "Signs". */
function conceptLabel(key) {
  const k = String(key || "");
  if (k.startsWith("topic:")) return titleize(k.slice(6));
  return titleize(k.replace(/-/g, " "));
}
function titleize(s) {
  const t = String(s || "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Days until the test: null (no date), negative (past), 0 (today). */
function daysUntil(testDate, today, dayMs) {
  const DAY = dayMs || (CoachCore ? CoachCore.DAY_MS : 86400000);
  if (!testDate || !today) return null;
  const a = Date.parse(today + "T00:00:00Z");
  const b = Date.parse(testDate + "T00:00:00Z");
  if (!isFinite(a) || !isFinite(b)) return null;
  return Math.round((b - a) / DAY);
}

/**
 * Study-phase band driven by the test date. The plan shifts with it:
 *   far      > 14 days  — broaden coverage, build foundations
 *   approach 8–14 days  — mixed recall, weak areas, more mocks
 *   final    2–7 days   — weak/high-value concepts, maintain strong ones
 *   eve      0–1 days   — light review, no cram, concise weaknesses
 *   past     < 0        — ask for a new date, keep progress
 */
function testPhase(daysLeft) {
  if (daysLeft == null) return "none";
  if (daysLeft < 0) return "past";
  if (daysLeft <= 1) return "eve";
  if (daysLeft <= 7) return "final";
  if (daysLeft <= 14) return "approach";
  return "far";
}

/* ---------------- concept diagnosis ---------------- */

/**
 * One diagnosis row per concept in the active bank. Everything downstream
 * (recommendations, Review Missed groups, mock debriefs) reads these rows
 * instead of recomputing stats inside renderers.
 *
 *   encounters  answers seen across the concept's questions
 *   unseen      questions never attempted
 *   due/overdue spaced-review pressure (due includes overdue)
 *   distinctWrong questions answered wrong at least once
 */
function conceptDiagnosis(bank, qstats, nowMs) {
  const stats = qstats || {};
  const now = nowMs == null ? Date.now() : nowMs;
  const groups = CoachCore.groupByConcept(bank || []);
  const out = [];
  for (const [key, qs] of groups) {
    let encounters = 0, correct = 0, wrong = 0, fastWrong = 0, slowRight = 0;
    let due = 0, overdue = 0, unseen = 0, distinctWrong = 0;
    let lastSeen = 0, lastWrong = 0;
    for (const q of qs) {
      const st = stats[q.id];
      if (!st || !st.seen) { unseen++; continue; }
      encounters += st.seen; correct += st.correct; wrong += st.wrong;
      fastWrong += st.fastWrong || 0; slowRight += st.slowRight || 0;
      lastSeen = Math.max(lastSeen, st.lastSeen || 0);
      lastWrong = Math.max(lastWrong, st.lastWrong || 0);
      if (st.wrong > 0) distinctWrong++;
      const d = CoachCore.schedDue(st, now);
      if (d === "now" || d === "overdue") due++;
      if (d === "overdue") overdue++;
    }
    const mastery = CoachCore.conceptMastery(qs, stats);
    out.push({
      key, label: conceptLabel(key), questions: qs,
      encounters, correct, wrong, fastWrong, slowRight,
      unseen, distinctWrong, due, overdue, lastSeen, lastWrong,
      mastery, coverage: qs.length ? (qs.length - unseen) / qs.length : 0,
    });
  }
  return out;
}

/**
 * What kind of problem a concept currently is. Maps onto the four honest
 * categories the learner sees, plus "misconception" for confident errors and
 * "stable" for concepts with nothing to do:
 *   misconception — repeated wrongs or fast-wrong evidence
 *   knowledge     — genuinely not known yet (wrong with little or no right)
 *   retention     — was learned; spaced review is now due or overdue
 *   fluency       — right, but slow (not automatic under time pressure)
 *   coverage      — never/rarely encountered
 */
function issueKind(d, misconceptionEntry) {
  const m = misconceptionEntry;
  if (m && !m.repairedAt && (m.errors >= 2 || (d.fastWrong > 0 && d.wrong >= 1))) return "misconception";
  if (d.overdue > 0 && d.mastery >= 0.5) return "retention";
  if (d.wrong >= 2 && d.correct === 0) return "knowledge";
  if (d.mastery < 0.5 && d.encounters > 0 && d.wrong > d.correct) return "knowledge";
  if (d.slowRight >= 2 && d.mastery >= 0.55) return "fluency";
  if (d.unseen > 0 && d.encounters === 0) return "coverage";
  if (d.unseen > 0 && d.mastery < 0.65) return "coverage";
  return "stable";
}

/* ---------------- misconception ledger (pure) ---------------- */
/*
 * state.misconceptions: conceptKey -> {
 *   errors, questionIds[], firstSeen, lastSeen, stage(1..3),
 *   solvedIds[], repairedAt
 * }
 * Tracked at CONCEPT level where the bank declares one, so "11 missed
 * questions map to 4 underlying concepts" is a first-class fact.
 */
function misconceptionStage(errors, prevStage) {
  let s = 1;
  if (errors >= 2) s = 2;
  if (errors >= 3) s = 3;
  return Math.max(prevStage || 1, s);
}

/** Record a wrong answer against its concept. Pure: returns a new map. */
function recordMisconception(map, conceptKey, qid, nowMs) {
  const out = Object.assign({}, map || {});
  const prev = out[conceptKey] || {
    errors: 0, questionIds: [], firstSeen: nowMs, lastSeen: 0,
    stage: 1, solvedIds: [], successes: 0, repairedAt: null,
  };
  const ids = prev.questionIds.includes(qid)
    ? prev.questionIds.slice()
    : prev.questionIds.concat(qid).slice(-12);
  const errors = prev.errors + 1;
  out[conceptKey] = Object.assign({}, prev, {
    errors,
    questionIds: ids,
    lastSeen: nowMs == null ? Date.now() : nowMs,
    stage: misconceptionStage(errors, prev.stage),
    // a fresh error reopens the case even if a variant had repaired it
    repairedAt: null,
  });
  return out;
}

/**
 * Record a correct answer against a concept that carries a misconception.
 * Repair requires evidence beyond repeating the same question: either a
 * DIFFERENT question of the concept (a variant) answered correctly, or two
 * correct answers overall after the error. One lucky repeat proves nothing.
 */
function noteConceptSuccess(map, conceptKey, qid, nowMs) {
  const out = Object.assign({}, map || {});
  const prev = out[conceptKey];
  if (!prev || prev.repairedAt) return out;
  const solvedIds = prev.solvedIds.includes(qid) ? prev.solvedIds.slice() : prev.solvedIds.concat(qid).slice(-12);
  const successes = (prev.successes || 0) + 1;
  const variantSolved = solvedIds.some((id) => !prev.questionIds.includes(id));
  const repaired = variantSolved || successes >= 2;
  out[conceptKey] = Object.assign({}, prev, {
    solvedIds,
    successes,
    repairedAt: repaired ? (nowMs == null ? Date.now() : nowMs) : null,
  });
  return out;
}

/** Active (unrepaired) misconceptions, persistent first, deterministic order. */
function activeMisconceptions(map) {
  return Object.entries(map || {})
    .filter(([, m]) => m && !m.repairedAt && m.errors > 0)
    .map(([key, m]) => Object.assign({ key, label: conceptLabel(key) }, m))
    .sort((a, b) => (b.stage - a.stage)
      || (b.errors - a.errors)
      || ((b.lastSeen || 0) - (a.lastSeen || 0))
      || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * The distinction line for a repeated misconception. Built ONLY from other
 * questions of the same bank (already verified and cited) — the coach never
 * invents a rule. Wording is deliberately hedged: "you may be mixing up".
 */
function confusionLine(entry, bank, qstats) {
  if (!entry) return null;
  const byConcept = CoachCore.groupByConcept(bank || []);
  const qs = byConcept.get(entry.key) || [];
  const missed = qs.filter((q) => entry.questionIds.includes(q.id));
  const sibling = qs.find((q) => !entry.questionIds.includes(q.id));
  if (!missed.length) return null;
  const wrongQ = missed[missed.length - 1];
  const rightChoice = Array.isArray(wrongQ.choices) ? wrongQ.choices[wrongQ.a] : null;
  if (sibling && rightChoice) {
    const sibRight = Array.isArray(sibling.choices) ? sibling.choices[sibling.a] : null;
    return {
      kind: "contrast",
      text: `You may be mixing up two rules in ${conceptLabel(entry.key)}: "${rightChoice}" (here) versus "${sibRight}" (a different scenario of the same rule).`,
      questionIds: [wrongQ.id, sibling.id],
    };
  }
  return {
    kind: "rule",
    text: `The rule to hold on to: "${rightChoice}". ${String(wrongQ.why || "").slice(0, 180)}`,
    questionIds: [wrongQ.id],
  };
}

/* ---------------- recommendation engine ---------------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Build the ranked candidate list. Pure and deterministic: candidates carry an
 * explicit `rank` (lower = more urgent) and sort with stable tie-breakers.
 *
 * Each candidate answers, in one object: what (drill kind + concept keys),
 * why (evidence strings), how much (questionCount + minutes), and which
 * issue kind the learner is looking at.
 */
function candidates(input) {
  const o = input || {};
  const bank = Array.isArray(o.bank) ? o.bank : [];
  const qstats = o.qstats || {};
  const exams = Array.isArray(o.exams) ? o.exams : [];
  const nowMs = o.nowMs == null ? Date.now() : o.nowMs;
  const today = o.today;
  const misconceptions = o.misconceptions || {};
  const daysLeft = o.daysLeft != null ? o.daysLeft : daysUntil(o.testDate, today);
  const phase = testPhase(daysLeft);
  const diags = conceptDiagnosis(bank, qstats, nowMs);
  const out = [];

  const coverage = bank.length ? bank.filter((q) => {
    const st = qstats[q.id];
    return st && st.seen > 0;
  }).length / bank.length : 0;

  /* --- misconception candidates (concept-level) --- */
  const active = activeMisconceptions(misconceptions);
  const activeByKey = new Map(active.map((m) => [m.key, m]));
  const misDiags = diags
    .map((d) => ({ d, m: activeByKey.get(d.key) }))
    .filter((x) => x.m && issueKind(x.d, x.m) === "misconception")
    .sort((a, b) => (b.m.stage - a.m.stage) || (b.m.errors - a.m.errors) || (a.d.mastery - b.d.mastery) || (a.d.key < b.d.key ? -1 : 1));
  if (misDiags.length) {
    const concepts = misDiags.slice(0, 6);
    const repeated = concepts.filter((x) => x.m.stage >= 2);
    const persistent = concepts.filter((x) => x.m.stage >= 3);
    const top = concepts[0];
    const questionCount = clamp(concepts.length * 2, 4, 12);
    out.push({
      type: REC_TYPES.FIX_MISCONCEPTION,
      rank: 10,
      issueKind: "misconception",
      drillKind: "misconception-drill",
      conceptKeys: concepts.map((x) => x.d.key),
      questionCount,
      minutes: Math.max(3, Math.round(questionCount * 0.8)),
      title: persistent.length
        ? `Repair ${persistent.length} persistent misconception${persistent.length === 1 ? "" : "s"}`
        : `Fix ${concepts.length} misconception${concepts.length === 1 ? "" : "s"} before they settle`,
      why: [
        `${top.d.label}: ${top.m.errors} wrong answer${top.m.errors === 1 ? "" : "s"}${top.d.fastWrong ? ` — ${top.d.fastWrong} of them answered quickly` : ""}.`,
        repeated.length
          ? `Repeated errors in ${repeated.length} concept${repeated.length === 1 ? "" : "s"} — a comparison of the confused rules plus a short drill comes first.`
          : "A concept variant follows the explanation so the rule is tested again in different wording.",
      ],
      detail: `Practise these ${concepts.length} concept${concepts.length === 1 ? "" : "s"} next.`,
      evidence: concepts.map((x) => ({ key: x.d.key, errors: x.m.errors, stage: x.m.stage, fastWrong: x.d.fastWrong })),
    });
  }

  /* --- overdue spaced review --- */
  const dueDiags = diags
    .filter((d) => d.overdue > 0)
    .sort((a, b) => (b.overdue - a.overdue) || (a.mastery - b.mastery) || (a.key < b.key ? -1 : 1));
  const overdueCount = dueDiags.reduce((t, d) => t + d.overdue, 0);
  if ((overdueCount >= 3) || (daysLeft != null && daysLeft >= 0 && daysLeft <= 3 && overdueCount >= 1)) {
    const questionCount = Math.min(12, Math.max(1, overdueCount));
    out.push({
      type: REC_TYPES.REVIEW_OVERDUE,
      rank: 20,
      issueKind: "retention",
      drillKind: "due-review",
      conceptKeys: dueDiags.slice(0, 6).map((d) => d.key),
      questionCount,
      minutes: Math.max(3, Math.round(questionCount * 0.7)),
      title: `Review ${overdueCount} question${overdueCount === 1 ? "" : "s"} that are due`,
      why: [
        `${dueDiags.length} concept${dueDiags.length === 1 ? " is" : "s are"} past their spaced-review date — this is retention work, not new learning.`,
        dueDiags[0] ? `${dueDiags[0].label} has ${dueDiags[0].overdue} overdue.` : "",
      ].filter(Boolean),
      detail: "Spaced review is what moves a fact from seen to known.",
      evidence: dueDiags.slice(0, 6).map((d) => ({ key: d.key, overdue: d.overdue })),
    });
  }

  /* --- fluency: right but slow --- */
  const slowDiags = diags
    .filter((d) => d.slowRight >= 2 && d.mastery >= 0.55 && d.overdue === 0)
    .sort((a, b) => (b.slowRight - a.slowRight) || (a.mastery - b.mastery) || (a.key < b.key ? -1 : 1));
  if (slowDiags.length >= 2) {
    const questionCount = clamp(slowDiags.length + 3, 5, 10);
    out.push({
      type: REC_TYPES.IMPROVE_FLUENCY,
      rank: 30,
      issueKind: "fluency",
      drillKind: "fluency-drill",
      conceptKeys: slowDiags.slice(0, 6).map((d) => d.key),
      questionCount,
      minutes: Math.max(3, Math.round(questionCount * 0.5)),
      title: `Do a ${questionCount}-question fluency drill`,
      why: [
        `${slowDiags.length} concepts are answered correctly but slowly — knowledge that is not automatic yet.`,
        `Top one: ${slowDiags[0].label} (${slowDiags[0].slowRight} slow-but-right answers).`,
      ],
      detail: "Speed these up before another mock: under time pressure, slow recall is what slips.",
      evidence: slowDiags.slice(0, 6).map((d) => ({ key: d.key, slowRight: d.slowRight })),
    });
  }

  /* --- weak topic --- */
  const topicStats = topicDiagnosis(bank, qstats, o.categories);
  const weakTopics = topicStats
    .filter((t) => t.mastery < 0.6 && t.encounters >= 6)
    .sort((a, b) => (a.mastery - b.mastery) || (b.encounters - a.encounters));
  if (weakTopics.length) {
    const t = weakTopics[0];
    const questionCount = 10;
    out.push({
      type: REC_TYPES.STRENGTHEN_WEAK_TOPIC,
      rank: phase === "final" ? 22 : 40,
      issueKind: "knowledge",
      drillKind: "topic-drill",
      conceptKeys: t.concepts.slice(0, 6).map((d) => d.key),
      topicId: t.id,
      questionCount,
      minutes: 8,
      title: `Strengthen ${t.name.toLowerCase()}`,
      why: [
        `${t.name} is at ${Math.round(t.mastery * 100)}% mastery across ${t.encounters} answers — your weakest measured topic.`,
        t.accuracy != null ? `Accuracy there is ${Math.round(t.accuracy * 100)}%.` : "",
      ].filter(Boolean),
      detail: `A 10-question set weighted to ${t.name.toLowerCase()} rebuilds the base the rest depends on.`,
      evidence: [{ topicId: t.id, mastery: t.mastery, encounters: t.encounters }],
    });
  }

  /* --- coverage --- */
  const coverageThreshold = phase === "far" ? 0.85 : 0.7;
  const unseenConcepts = diags
    .filter((d) => d.unseen > 0)
    .sort((a, b) => (b.unseen - a.unseen) || (a.mastery - b.mastery) || (a.key < b.key ? -1 : 1));
  const unseenNeeded = unseenConcepts.reduce((t, d) => t + Math.min(d.unseen, 2), 0);
  if (coverage < coverageThreshold && unseenConcepts.length) {
    const questionCount = clamp(unseenNeeded, 5, 12);
    out.push({
      type: REC_TYPES.BUILD_COVERAGE,
      rank: coverage < 0.35 ? 30 : phase === "far" ? 32 : 55,
      issueKind: "coverage",
      drillKind: "coverage-practice",
      conceptKeys: unseenConcepts.slice(0, 6).map((d) => d.key),
      questionCount,
      minutes: Math.max(4, Math.round(questionCount * 0.8)),
      title: `Practise ${questionCount} questions you have not seen yet`,
      why: [
        `You have covered ${Math.round(coverage * 100)}% of the current bank — unseen concepts are the cheapest marks available.`,
        `${unseenConcepts.length} concept${unseenConcepts.length === 1 ? " has" : "s have"} never been attempted.`,
      ],
      detail: `Start with ${unseenConcepts.slice(0, 2).map((d) => d.label).join(" and ")}.`,
      evidence: unseenConcepts.slice(0, 6).map((d) => ({ key: d.key, unseen: d.unseen })),
    });
  }

  /* --- mock timing --- */
  const recentMocks = exams.filter((e) => e && e.tag !== "diagnostic");
  const lastMock = recentMocks.length ? recentMocks[recentMocks.length - 1] : null;
  const daysSinceMock = lastMock && lastMock.date ? Math.floor((nowMs - lastMock.date) / CoachCore.DAY_MS) : null;
  const stability = CoachCore.mockStability(exams, 3);
  const cleanEnough = active.length === 0 && overdueCount < 3 && coverage >= 0.7;
  if (!lastMock && (daysLeft == null || daysLeft > 3) && coverage >= 0.5) {
    out.push({
      type: REC_TYPES.TAKE_MOCK,
      rank: 38,
      issueKind: "stable",
      drillKind: "mock",
      conceptKeys: [],
      questionCount: 0,
      minutes: 12,
      title: "Take a baseline mock exam",
      why: [
        "You have not taken a mock yet — one timed run measures where you actually stand.",
        "It also gives the coach new evidence: mock errors reveal different things than practice errors.",
      ],
      detail: "The Quick Check (10 questions) is enough to start.",
      evidence: [],
    });
  } else if (!lastMock) {
    // Little content covered: a mock now would mostly measure what has not
    // been taught yet. Say so instead of recommending the mock.
  } else if (cleanEnough && (daysLeft == null || daysLeft > 14) && (daysSinceMock == null || daysSinceMock >= 2)) {
    out.push({
      type: REC_TYPES.TAKE_MOCK,
      rank: 60,
      issueKind: "stable",
      drillKind: "mock",
      conceptKeys: [],
      questionCount: 0,
      minutes: 20,
      title: "Take a mock exam",
      why: [
        `Coverage is ${Math.round(coverage * 100)}% and nothing is overdue — a full mock is the most informative next step.`,
        stability != null && stability > 0.15 ? "Recent mock scores vary, so treat this one as another sample, not a verdict." : "",
      ].filter(Boolean),
      detail: "The debrief turns any misses into a targeted drill.",
      evidence: [],
    });
  } else if (phase === "approach" && lastMock && daysSinceMock != null && daysSinceMock >= 3) {
    out.push({
      type: REC_TYPES.TAKE_MOCK,
      rank: 35,
      issueKind: "stable",
      drillKind: "mock",
      conceptKeys: [],
      questionCount: 0,
      minutes: 20,
      title: "Add a mock this week",
      why: [
        `Your test is ${daysLeft} days away and your last mock was ${daysSinceMock} day${daysSinceMock === 1 ? "" : "s"} ago.`,
        "In the final two weeks, timed reps matter more than new content.",
      ],
      detail: "Keep sessions mixed: recall under time pressure is the skill being tested.",
      evidence: [],
    });
  }

  /* --- test-day eve: light review always wins the primary slot --- */
  if (phase === "eve") {
    const focus = misDiags.map((x) => x.d.key)
      .concat(dueDiags.slice(0, 2).map((d) => d.key))
      .slice(0, 4);
    const questionCount = clamp(4 + focus.length, 4, 8);
    out.push({
      type: REC_TYPES.LIGHT_REVIEW,
      rank: 0,
      issueKind: "retention",
      drillKind: "light-review",
      conceptKeys: focus,
      questionCount,
      minutes: Math.max(3, Math.round(questionCount * 0.6)),
      title: daysLeft === 0 ? "Light confidence review" : "Short review — then stop",
      why: [
        daysLeft === 0
          ? "It is test day. A few familiar questions keep the rules warm; cramming does not add knowledge today."
          : "Your test is tomorrow. A short, easy session beats a late cram.",
        focus.length ? `Only what matters: ${focus.slice(0, 3).map(conceptLabel).join(", ")}.` : "Everything measured is holding — keep it light.",
      ],
      detail: "No new topics today. Rest is part of the plan.",
      evidence: focus.map((key) => ({ key })),
    });
  }

  /* --- everything strong: maintenance --- */
  const strongOnly = diags.length > 0 && diags.every((d) => d.mastery >= 0.75) && active.length === 0;
  if (strongOnly && !out.length) {
    out.push({
      type: REC_TYPES.MAINTAIN_STRONG,
      rank: 90,
      issueKind: "retention",
      drillKind: "maintain",
      conceptKeys: diags.slice().sort((a, b) => (a.mastery - b.mastery) || (a.key < b.key ? -1 : 1)).slice(0, 5).map((d) => d.key),
      questionCount: 6,
      minutes: 4,
      title: "Maintain your strong knowledge",
      why: ["Every concept you have met is above 75% mastery — a short mixed recall keeps them there."],
      detail: "Six questions, oldest reviews first.",
      evidence: [],
    });
  }

  // Deterministic order: rank, then type name, then first concept key.
  return out.sort((a, b) => (a.rank - b.rank)
    || (a.type < b.type ? -1 : a.type > b.type ? 1 : 0)
    || ((a.conceptKeys[0] || "") < (b.conceptKeys[0] || "") ? -1 : 1));
}

/** Per-topic mastery + accuracy + concept lists (for weak-topic recommendations). */
function topicDiagnosis(bank, qstats, categories) {
  const cats = categories || {};
  const byCat = new Map();
  for (const q of bank || []) {
    if (!byCat.has(q.cat)) byCat.set(q.cat, []);
    byCat.get(q.cat).push(q);
  }
  const out = [];
  for (const [id, qs] of byCat) {
    const st = qstats || {};
    let encounters = 0;
    for (const q of qs) { const s = st[q.id]; if (s && s.seen) encounters += s.seen; }
    const mastery = CoachCore.topicMastery(qs, st);
    const accuracy = CoachCore.catAccuracy(qs, st);
    const concepts = CoachCore.groupByConcept(qs);
    out.push({
      id,
      name: (cats[id] && cats[id].name) || titleize(id),
      mastery, accuracy, encounters,
      questionCount: qs.length,
      concepts: [...concepts.entries()].map(([key, cqs]) => ({
        key, label: conceptLabel(key), mastery: CoachCore.conceptMastery(cqs, st),
      })).sort((a, b) => (a.mastery - b.mastery) || (a.key < b.key ? -1 : 1)),
    });
  }
  return out.sort((a, b) => (a.mastery - b.mastery) || (a.id < b.id ? -1 : 1));
}

/**
 * THE plan: one primary recommendation, up to two supporting ones, and the
 * measured evidence behind them. Deterministic — same inputs, same plan.
 */
function recommend(input) {
  const list = candidates(input);
  const primary = list[0] || null;
  return {
    coachVersion: COACH_VERSION,
    primary,
    secondary: list.slice(1, 3),
    all: list,
    phase: testPhase(input && input.daysLeft != null ? input.daysLeft : daysUntil(input && input.testDate, input && input.today)),
  };
}

/* ---------------- session-over-session delta ---------------- */

/**
 * Snapshot of the measured signals a learner cares about, stored after each
 * session so the next plan can say what CHANGED — the question statistics
 * alone cannot answer.
 */
function buildSnapshot(input) {
  const o = input || {};
  const bank = Array.isArray(o.bank) ? o.bank : [];
  const qstats = o.qstats || {};
  const diags = conceptDiagnosis(bank, qstats, o.nowMs);
  const active = activeMisconceptions(o.misconceptions || {});
  const coverage = bank.length
    ? Math.round(100 * bank.filter((q) => qstats[q.id] && qstats[q.id].seen).length / bank.length) : 0;
  const masterySum = diags.reduce((t, d) => t + d.mastery, 0);
  return {
    at: o.nowMs == null ? Date.now() : o.nowMs,
    coveragePct: coverage,
    masteryPct: diags.length ? Math.round(100 * masterySum / diags.length) : 0,
    masteredConcepts: diags.filter((d) => d.mastery >= 0.8).length,
    misconceptionConcepts: active.filter((m) => m.stage >= 2).length,
    overdue: diags.reduce((t, d) => t + d.overdue, 0),
    mockPct: o.lastMockPct == null ? null : Math.round(o.lastMockPct * 100) / 100,
    questionsAnswered: o.questionsAnswered || 0,
  };
}

/**
 * What changed since the previous session, in learner language.
 * Honest fallback when nothing measurable moved.
 */
function sessionDelta(prev, curr) {
  const lines = [];
  if (!prev || !curr) return { lines: [], first: !prev };
  if (curr.coveragePct !== prev.coveragePct) {
    lines.push(`Coverage ${prev.coveragePct}% → ${curr.coveragePct}%`);
  }
  if (curr.masteredConcepts !== prev.masteredConcepts) {
    const d = curr.masteredConcepts - prev.masteredConcepts;
    lines.push(d > 0
      ? `${d} concept${d === 1 ? "" : "s"} moved to mastered`
      : `${-d} concept${-d === 1 ? "" : "s"} fell back from mastered`);
  }
  if (curr.misconceptionConcepts > prev.misconceptionConcepts) {
    const d = curr.misconceptionConcepts - prev.misconceptionConcepts;
    lines.push(`${d} new persistent misconception${d === 1 ? "" : "s"}`);
  } else if (curr.misconceptionConcepts < prev.misconceptionConcepts) {
    const d = prev.misconceptionConcepts - curr.misconceptionConcepts;
    lines.push(`${d} misconception${d === 1 ? "" : "s"} cleared`);
  }
  if (curr.overdue < prev.overdue) {
    lines.push(`${prev.overdue - curr.overdue} overdue review${prev.overdue - curr.overdue === 1 ? "" : "s"} cleared`);
  } else if (curr.overdue > prev.overdue) {
    lines.push(`${curr.overdue - prev.overdue} new review${curr.overdue - prev.overdue === 1 ? "" : "s"} came due`);
  }
  if (prev.mockPct != null && curr.mockPct != null && curr.mockPct !== prev.mockPct) {
    lines.push(`Latest mock ${Math.round(prev.mockPct * 100)}% → ${Math.round(curr.mockPct * 100)}%`);
  }
  return { lines, first: false, changed: lines.length > 0 };
}

/**
 * End-of-session summary: not just the score, but what the session DID —
 * concepts strengthened, misconceptions resolved, concepts still weak,
 * coverage movement, and the best next action for tomorrow.
 */
function sessionSummary(input) {
  const o = input || {};
  const answers = Array.isArray(o.answers) ? o.answers : [];
  const misconceptions = o.misconceptions || {};
  const prev = o.prevSnapshot || null;
  const curr = o.snapshot || buildSnapshot(o);
  const delta = sessionDelta(prev, curr);
  const nowMs = o.nowMs == null ? Date.now() : o.nowMs;

  const byConcept = new Map();
  for (const a of answers) {
    // byId is a lookup function (id -> question) in callers, with a map
    // accepted for convenience.
    const q = typeof o.byId === "function" ? o.byId(a.qid) : (o.byId && o.byId[a.qid]) || null;
    if (!q) continue;
    const key = CoachCore.conceptKeyOf(q);
    const c = byConcept.get(key) || { right: 0, wrong: 0 };
    if (a.right) c.right++; else c.wrong++;
    byConcept.set(key, c);
  }
  const strengthened = [];
  const stillWeak = [];
  for (const [key, c] of byConcept) {
    const entry = misconceptions[key];
    const repairedNow = entry && entry.repairedAt && entry.repairedAt >= (o.sessionStartedAt || 0);
    if (repairedNow) continue; // counted in resolved below
    if (c.wrong === 0 && c.right >= 2) strengthened.push(conceptLabel(key));
    else if (c.wrong > c.right) stillWeak.push(conceptLabel(key));
  }
  const resolved = Object.entries(misconceptions)
    .filter(([, m]) => m && m.repairedAt && m.repairedAt >= (o.sessionStartedAt || 0))
    .map(([key]) => conceptLabel(key));

  return {
    questionCount: answers.length,
    correct: answers.filter((a) => a.right).length,
    strengthened,
    resolvedMisconceptions: resolved,
    stillWeak,
    coverageDelta: prev && curr ? curr.coveragePct - prev.coveragePct : null,
    delta,
    nextAction: o.nextAction || null,
    at: nowMs,
  };
}

/**
 * Post-mock repair report: after the targeted drill, how many of the mock's
 * weaknesses actually got repaired. `weaknessKeys` are the concepts the mock
 * debrief flagged; the drill's answers show which of them now hold.
 */
function repairReport(weaknessKeys, drillAnswers, qstats, misconceptions, nowMs) {
  const keys = Array.isArray(weaknessKeys) ? weaknessKeys : [];
  const answers = Array.isArray(drillAnswers) ? drillAnswers : [];
  const byKey = new Map(keys.map((k) => [k, { key: k, right: 0, wrong: 0 }]));
  for (const a of answers) {
    const key = a.conceptKey || null;
    if (!key || !byKey.has(key)) continue;
    const r = byKey.get(key);
    if (a.right) r.right++; else r.wrong++;
  }
  let repaired = 0;
  const rows = [...byKey.values()].map((r) => {
    const m = (misconceptions || {})[r.key];
    const misResolved = m && m.repairedAt && m.repairedAt >= (nowMs == null ? 0 : nowMs - 86400000);
    const ok = (r.right > r.wrong) || misResolved;
    if (ok) repaired++;
    return { key: r.key, label: conceptLabel(r.key), repaired: ok, right: r.right, wrong: r.wrong };
  });
  return {
    total: keys.length,
    repaired,
    rows,
    line: keys.length
      ? `${repaired} of your ${keys.length} mock weakness${keys.length === 1 ? "" : "es"} ${repaired === 1 ? "was" : "were"} repaired.`
      : "No mock weaknesses to repair — clean run.",
  };
}

/* ---------------- Review Missed: weakness groups ---------------- */

/**
 * Turn "every question you ever missed" into a short prioritised weakness
 * list: misconception patterns first, then persistent errors, recent errors,
 * fast-wrong, slow-right and overdue review. Each group carries a one-tap
 * drill (question ids) and a single "why it matters" line.
 */
function reviewGroups(input) {
  const o = input || {};
  const bank = Array.isArray(o.bank) ? o.bank : [];
  const qstats = o.qstats || {};
  const nowMs = o.nowMs == null ? Date.now() : o.nowMs;
  const misconceptions = o.misconceptions || {};
  const diags = conceptDiagnosis(bank, qstats, nowMs);
  const missed = CoachCore.missedQuestions(bank, qstats);
  const missedIds = new Set(missed.map((q) => q.id));

  const byConcept = new Map();
  for (const q of missed) {
    const key = CoachCore.conceptKeyOf(q);
    if (!byConcept.has(key)) byConcept.set(key, []);
    byConcept.get(key).push(q);
  }

  const active = activeMisconceptions(misconceptions);
  const activeKeys = new Set(active.map((m) => m.key));
  const diagByKey = new Map(diags.map((d) => [d.key, d]));

  const misItems = active
    .filter((m) => byConcept.has(m.key))
    .map((m) => ({
      key: m.key, label: m.label, stage: m.stage, errors: m.errors,
      kind: "misconception",
      why: m.stage >= 2
        ? `${m.errors} wrong answers${(diagByKey.get(m.key) || {}).fastWrong ? ` (${diagByKey.get(m.key).fastWrong} answered quickly)` : ""} — a commonly confused pair of rules.`
        : "An early misconception — cheaper to repair now than at the test.",
      questionIds: byConcept.get(m.key).map((q) => q.id),
      drillIds: drillIdsForConcept(m.key, bank, qstats, missedIds),
    }));

  const persistentItems = [];
  const recentItems = [];
  for (const [key, qs] of byConcept) {
    if (activeKeys.has(key)) continue;
    const d = diagByKey.get(key);
    const persistent = qs.length >= 2 || (d && d.wrong >= 2);
    const item = {
      key, label: conceptLabel(key),
      kind: persistent ? "knowledge" : (d && d.overdue ? "retention" : "knowledge"),
      why: persistent
        ? `${qs.length} different questions of this concept have been missed — the underlying rule needs work, not the question.`
        : (d && d.overdue ? "Missed and now past its review date — this is fading." : "Missed recently — one clean review should clear it."),
      questionIds: qs.map((q) => q.id),
      drillIds: drillIdsForConcept(key, bank, qstats, missedIds),
    };
    (persistent ? persistentItems : recentItems).push(item);
  }
  persistentItems.sort((a, b) => (b.questionIds.length - a.questionIds.length) || (a.key < b.key ? -1 : 1));
  recentItems.sort((a, b) => (a.key < b.key ? -1 : 1));

  const fastWrong = missed.filter((q) => (qstats[q.id].fastWrong || 0) > 0);
  const slowRight = bank.filter((q) => qstats[q.id] && (qstats[q.id].slowRight || 0) > 0);
  const overdueQs = bank.filter((q) => {
    const st = qstats[q.id];
    return st && st.seen > 0 && CoachCore.schedDue(st, nowMs) === "overdue";
  });

  const groups = [];
  if (misItems.length) {
    groups.push({
      id: "misconceptions", priority: 1,
      title: "Misconception patterns",
      why: "Repeated errors on the same underlying rule. These do not fix themselves by re-reading.",
      items: misItems,
      drillIds: misItems.flatMap((i) => i.drillIds).slice(0, 15),
    });
  }
  if (persistentItems.length) {
    groups.push({
      id: "persistent", priority: 2,
      title: "Persistent errors",
      why: "Missed in more than one question or more than one session — treat the concept, not the question.",
      items: persistentItems,
      drillIds: persistentItems.flatMap((i) => i.drillIds).slice(0, 15),
    });
  }
  if (recentItems.length) {
    groups.push({
      id: "recent", priority: 3,
      title: "Recent misses",
      why: "Newly wrong. One clean review usually clears these.",
      items: recentItems,
      drillIds: recentItems.flatMap((i) => i.drillIds).slice(0, 15),
    });
  }
  if (fastWrong.length) {
    groups.push({
      id: "fast-wrong", priority: 4,
      title: "Answered fast and wrong",
      why: "You were confident and wrong — the most dangerous kind of error, and invisible to a plain wrong-count.",
      items: fastWrong.slice(0, 8).map((q) => ({
        key: CoachCore.conceptKeyOf(q), label: conceptLabel(CoachCore.conceptKeyOf(q)),
        kind: "misconception", why: `Answered quickly and wrongly ${qstats[q.id].fastWrong}×.`,
        questionIds: [q.id], drillIds: [q.id],
      })),
      drillIds: fastWrong.slice(0, 10).map((q) => q.id),
    });
  }
  if (slowRight.length) {
    groups.push({
      id: "slow-right", priority: 5,
      title: "Right, but slow",
      why: "Knowledge that is not automatic yet — exactly what slips under exam time pressure.",
      items: slowRight.slice(0, 8).map((q) => ({
        key: CoachCore.conceptKeyOf(q), label: conceptLabel(CoachCore.conceptKeyOf(q)),
        kind: "fluency", why: `Correct but slow ${qstats[q.id].slowRight}×.`,
        questionIds: [q.id], drillIds: [q.id],
      })),
      drillIds: slowRight.slice(0, 10).map((q) => q.id),
    });
  }
  if (overdueQs.length) {
    groups.push({
      id: "overdue", priority: 6,
      title: "Overdue review",
      why: "Learned once, now past the date spaced practice set. Ten seconds each keeps them alive.",
      items: overdueQs.slice(0, 8).map((q) => ({
        key: CoachCore.conceptKeyOf(q), label: conceptLabel(CoachCore.conceptKeyOf(q)),
        kind: "retention", why: "Past its spaced-review date.",
        questionIds: [q.id], drillIds: [q.id],
      })),
      drillIds: overdueQs.slice(0, 10).map((q) => q.id),
    });
  }

  const conceptCount = byConcept.size;
  return {
    groups,
    summary: missed.length
      ? {
          text: conceptCount && conceptCount < missed.length
            ? `${missed.length} missed question${missed.length === 1 ? "" : "s"} map to only ${conceptCount} underlying concept${conceptCount === 1 ? "" : "s"}.`
            : `${missed.length} question${missed.length === 1 ? "" : "s"} to review.`,
          missedCount: missed.length,
          conceptCount,
        }
      : null,
  };
}

/**
 * Drill ids for one concept: prefer never-missed sibling questions (fresh
 * variants — the point is to test the RULE, not replay the question), then
 * the missed ones. Deterministic order: hardest first, then id.
 */
function drillIdsForConcept(key, bank, qstats, missedIds) {
  const qs = (CoachCore.groupByConcept(bank || []).get(key) || []);
  const fresh = qs.filter((q) => !missedIds.has(q.id));
  const sortFn = (a, b) => (CoachCore.qDifficulty(qstats[b.id]) - CoachCore.qDifficulty(qstats[a.id]))
    || (a.id < b.id ? -1 : 1);
  return fresh.sort(sortFn).concat(qs.filter((q) => missedIds.has(q.id)).sort(sortFn)).map((q) => q.id);
}

/* ---------------- mock debrief + post-mock drill ---------------- */

/**
 * Diagnostic summary of one finished mock. Concise by design: score + result,
 * topic breakdown, concept-level weaknesses, repeated misconceptions, slow
 * answers, right→wrong regressions, recently-learned wins, and the next
 * session. No chart farm.
 *
 * `answers` items: { qid, right, picked, rtMs, regressed, learned } where
 * regressed/learned are recorded at answer time against prior exposure.
 */
function mockDebrief(input) {
  const o = input || {};
  const bank = Array.isArray(o.bank) ? o.bank : [];
  const qstats = o.qstats || {};
  const answers = Array.isArray(o.answers) ? o.answers : [];
  const misconceptions = o.misconceptions || {};
  const categories = o.categories || {};
  const byId = new Map(bank.map((q) => [q.id, q]));
  const missed = answers.filter((a) => !a.right);
  const correct = answers.length - missed.length;

  const topicTally = new Map();
  const conceptTally = new Map();
  for (const a of answers) {
    const q = byId.get(a.qid);
    if (!q) continue;
    const t = topicTally.get(q.cat) || { ok: 0, total: 0 };
    t.total++; if (a.right) t.ok++;
    topicTally.set(q.cat, t);
    const key = CoachCore.conceptKeyOf(q);
    const c = conceptTally.get(key) || { missed: 0, total: 0 };
    c.total++; if (!a.right) c.missed++;
    conceptTally.set(key, c);
  }

  const topicBreakdown = [...topicTally.entries()]
    .map(([id, t]) => ({
      id,
      name: (categories[id] && categories[id].name) || titleize(id),
      ok: t.ok, total: t.total,
    }))
    .sort((a, b) => (a.ok / a.total) - (b.ok / b.total) || (b.total - a.total));

  const diagByKey = new Map(conceptDiagnosis(bank, qstats, o.nowMs).map((d) => [d.key, d]));
  const conceptWeaknesses = [...conceptTally.entries()]
    .filter(([, c]) => c.missed > 0)
    .map(([key, c]) => {
      const d = diagByKey.get(key);
      return {
        key, label: conceptLabel(key),
        missed: c.missed, total: c.total,
        mastery: d ? d.mastery : 0,
        kind: d ? issueKind(d, misconceptions[key]) : "knowledge",
      };
    })
    .sort((a, b) => (b.missed - a.missed) || (a.mastery - b.mastery) || (a.key < b.key ? -1 : 1));

  const repeatedMisconceptions = activeMisconceptions(misconceptions)
    .filter((m) => conceptTally.has(m.key) && conceptTally.get(m.key).missed > 0)
    .map((m) => ({ key: m.key, label: m.label, stage: m.stage, errors: m.errors }));

  const slowAnswers = answers
    .filter((a) => a.rtMs != null && o.slowMs != null && a.rtMs > o.slowMs && a.right)
    .map((a) => ({ qid: a.qid, rtMs: a.rtMs, label: conceptLabel(CoachCore.conceptKeyOf(byId.get(a.qid) || {})) }));

  const regressions = answers.filter((a) => a.regressed).map((a) => ({
    qid: a.qid,
    label: conceptLabel(CoachCore.conceptKeyOf(byId.get(a.qid) || {})),
  }));
  const recentlyLearned = answers.filter((a) => a.learned && a.right).map((a) => ({
    qid: a.qid,
    label: conceptLabel(CoachCore.conceptKeyOf(byId.get(a.qid) || {})),
  }));

  return {
    correct, total: answers.length,
    scorePct: answers.length ? correct / answers.length : 0,
    topicBreakdown,
    conceptWeaknesses,
    repeatedMisconceptions,
    slowAnswers,
    regressions,
    recentlyLearned,
  };
}

/**
 * "Turn this mock into a targeted study session."
 * Builds a drill from the CONCEPTS missed — never a replay of the same
 * questions. Deterministic: concept severity first, hardest fresh questions
 * first, stable id tie-break. Falls back to including mock questions only
 * when a concept has no fresh variant, and says so in `note`.
 */
function postMockDrill(input) {
  const o = input || {};
  const bank = Array.isArray(o.bank) ? o.bank : [];
  const qstats = o.qstats || {};
  const answers = Array.isArray(o.answers) ? o.answers : [];
  const byId = new Map(bank.map((q) => [q.id, q]));
  const answeredIds = new Set(answers.map((a) => a.qid));
  const missedConcepts = new Map();
  for (const a of answers) {
    if (a.right) continue;
    const q = byId.get(a.qid);
    if (!q) continue;
    const key = CoachCore.conceptKeyOf(q);
    missedConcepts.set(key, (missedConcepts.get(key) || 0) + 1);
  }
  const conceptOrder = [...missedConcepts.entries()]
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .map(([key]) => key);

  const target = clamp(missedConcepts.size ? Math.max(5, Math.min(12, answers.filter((x) => !x.right).length + 2)) : 0, 5, 12);
  const picked = [];
  const used = new Set();
  let fellBack = false;
  const hardestFirst = (qs) => qs.slice().sort((a, b) =>
    (CoachCore.qDifficulty(qstats[b.id]) - CoachCore.qDifficulty(qstats[a.id])) || (a.id < b.id ? -1 : 1));
  const conceptGroups = CoachCore.groupByConcept(bank);

  for (const key of conceptOrder) {
    if (picked.length >= target) break;
    const qs = (conceptGroups.get(key) || []);
    const fresh = hardestFirst(qs.filter((q) => !answeredIds.has(q.id)));
    const take = fresh.slice(0, 2);
    for (const q of take) {
      if (picked.length >= target) break;
      picked.push(q); used.add(q.id);
    }
    if (!take.length) {
      // concept has no fresh variant — reuse the mock's questions and admit it
      const seen = hardestFirst(qs.filter((q) => answeredIds.has(q.id) && !used.has(q.id)));
      if (seen.length) {
        picked.push(seen[0]); used.add(seen[0].id);
        fellBack = true;
      }
    }
  }
  // pad with untouched questions so the drill is never smaller than 5
  if (picked.length < Math.min(5, bank.length)) {
    const pad = hardestFirst(bank.filter((q) => !used.has(q.id) && !answeredIds.has(q.id)));
    for (const q of pad) {
      if (picked.length >= Math.min(5, bank.length)) break;
      picked.push(q); used.add(q.id);
    }
  }

  return {
    questions: picked,
    conceptKeys: conceptOrder,
    label: conceptOrder.length
      ? `Targeted drill — ${conceptOrder.length} concept${conceptOrder.length === 1 ? "" : "s"} from this mock`
      : "Targeted drill",
    reason: conceptOrder.length
      ? `Built from the ${conceptOrder.length} concept${conceptOrder.length === 1 ? "" : "s"} you missed — different questions, same rules.`
      : "Nothing missed — a short mixed set keeps things warm.",
    note: fellBack
      ? "One or more concepts had no unseen questions left, so a mock question repeats — that concept needs new variants."
      : null,
  };
}

/**
 * THE WEAKNESS CENTRE — concept-level problems, each solvable.
 * Groups (priority order):
 *   misconception      — recurring errors on one rule ("4 mistakes across 7 attempts")
 *   slow-but-correct   — right, but not automatic yet
 *   recent-regressions — previously mastered, now slipping
 *   overdue            — learned once, fading
 *   unseen-high-value  — never met but heavily weighted in the test
 * Each problem carries a concrete action set: repair misconception, drill,
 * view rule, mark for later. Weaknesses must feel SOLVABLE, not an analytics dump.
 */
function weaknessCentre(input) {
  const o = input || {};
  const bank = Array.isArray(o.bank) ? o.bank : [];
  const qstats = o.qstats || {};
  const misconceptions = o.misconceptions || {};
  const nowMs = o.nowMs == null ? Date.now() : o.nowMs;
  const diags = conceptDiagnosis(bank, qstats, nowMs);
  const groups = CoachCore.groupByConcept(bank);
  const missedIds = new Set(CoachCore.missedQuestions(bank, qstats).map((q) => q.id));
  const active = activeMisconceptions(misconceptions);
  const activeKeys = new Set(active.map((m) => m.key));

  const mkProblem = (d, category, problemLine, extra) => Object.assign({
    key: d.key,
    label: d.label,
    category,
    problem: problemLine,
    attempts: d.encounters,
    mistakes: d.wrong,
    questionIds: (groups.get(d.key) || []).map((q) => q.id),
    drillIds: drillIdsForConcept(d.key, bank, qstats, missedIds),
    actions: category === "misconception"
      ? ["repair", "drill", "rule", "later"]
      : ["drill", "rule", "later"],
  }, extra || {});

  const misconceptionProblems = active
    .filter((m) => groups.has(m.key))
    .map((m) => {
      const d = diags.find((x) => x.key === m.key) || { key: m.key, label: m.label, encounters: m.errors, wrong: m.errors };
      return mkProblem(d, "misconception",
        `You may be giving priority to the wrong rule here — ${m.errors} mistake${m.errors === 1 ? "" : "s"} across ${d.encounters} attempt${d.encounters === 1 ? "" : "s"}.`,
        { stage: m.stage, errors: m.errors });
    })
    .sort((a, b) => (b.stage - a.stage) || (b.errors - a.errors));

  const slowProblems = diags
    .filter((d) => d.slowRight >= 2 && d.mastery >= 0.55 && !activeKeys.has(d.key))
    .map((d) => mkProblem(d, "slow-but-correct",
      `You know this rule, but it is not automatic yet — ${d.slowRight} slow-but-correct answer${d.slowRight === 1 ? "" : "s"}.`))
    .sort((a, b) => b.mistakes - a.mistakes);

  // Regressions: mastery holding but a fresh wrong after a clean period.
  const regressionProblems = diags
    .filter((d) => d.mastery >= 0.55 && d.wrong > 0 && d.lastWrong > (d.lastSeen - 7 * 86400000) && d.correct >= 2 && !activeKeys.has(d.key))
    .slice(0, 4)
    .map((d) => mkProblem(d, "recent-regression",
      `You previously had this solid — recent answers are slipping.`));

  const overdueProblems = diags
    .filter((d) => d.overdue > 0 && d.mastery >= 0.5)
    .map((d) => mkProblem(d, "overdue",
      `Learned once, now ${d.overdue} review${d.overdue === 1 ? " is" : "s are"} past due — at risk of being forgotten.`))
    .slice(0, 5);

  // Unseen high-value concepts: never met and many questions available.
  const unseenProblems = diags
    .filter((d) => d.unseen > 0 && d.encounters === 0 && d.questions.length >= 2)
    .slice(0, 5)
    .map((d) => mkProblem(d, "unseen-high-value",
      `${d.questions.length} untested question${d.questions.length === 1 ? "" : "s"} on this rule — worth meeting before test day.`));

  const sections = [
    { id: "misconception", title: "Recurring mistakes", why: "One rule keeps catching you — fix the confusion once and it stops costing marks.", problems: misconceptionProblems },
    { id: "slow-but-correct", title: "Slow but correct", why: "You know these rules, but they are not automatic yet.", problems: slowProblems },
    { id: "recent-regression", title: "Recent regressions", why: "You previously mastered these concepts but have recently started missing them.", problems: regressionProblems },
    { id: "overdue", title: "Overdue", why: "Knowledge at risk of being forgotten.", problems: overdueProblems },
    { id: "unseen-high-value", title: "Unseen high-value concepts", why: "Never tested yet — and worth marks on the real test.", problems: unseenProblems },
  ].filter((s) => s.problems.length);

  return {
    sections,
    totalProblems: sections.reduce((t, s) => t + s.problems.length, 0),
    resolvedCount: Object.values(misconceptions).filter((m) => m && m.repairedAt).length,
    recurringCount: misconceptionProblems.length,
  };
}

const RoadReadyCoach = {
  COACH_VERSION, REC_TYPES, ISSUE_KINDS,
  conceptLabel, daysUntil, testPhase,
  conceptDiagnosis, topicDiagnosis, issueKind,
  misconceptionStage, recordMisconception, noteConceptSuccess, activeMisconceptions, confusionLine,
  candidates, recommend,
  buildSnapshot, sessionDelta, sessionSummary, repairReport,
  reviewGroups, drillIdsForConcept, weaknessCentre,
  mockDebrief, postMockDrill,
};

if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyCoach;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyCoach = RoadReadyCoach;
