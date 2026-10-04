/* Road Ready — coaching explanations & mistake taxonomy (pure, DOM-free).
 *
 * Two responsibilities:
 *
 * 1. MISTAKE TAXONOMY — when an answer is wrong, classify what probably went
 *    wrong so the repair flow knows what to say. The evidence is limited (we
 *    see the answer, the timing, and the bank), so every label is hedged:
 *    "you may be…". Never a claimed psychological fact.
 *      lapse       — the rule was known before; a simple memory slip
 *      rule        — genuine misunderstanding of the rule
 *      confusion   — mixed up with a similar rule (similar concept or sign)
 *      wording     — the tempting choice rides on a wording trap
 *      visual      — sign/artwork confusion
 *      rushed      — answered fast and wrong (confident-error)
 *      overthinking— answered slowly and wrong on an otherwise-known concept
 *      weak-concept— underlying concept still weak overall
 *
 * 2. COACH EXPLANATIONS — plain-English copy for each recommendation
 *    situation: what RoadReady noticed, why it matters, what to do, how much,
 *    and what result counts as improvement. No analytics jargon.
 *
 * Classic-script module: js/explain.js after js/core.js and js/coach.js.
 */
"use strict";

const ExplainCore = (typeof module !== "undefined" && module.exports)
  ? require("./core.js")
  : (typeof globalThis !== "undefined" ? globalThis.RoadReadyCore : null);

/* ---------------- mistake taxonomy ---------------- */

/**
 * Classify one wrong answer. Inputs:
 *   q            the question
 *   stat         its per-question stat (history)
 *   rtMs         this answer's response time (null when unknown)
 *   pct          learner response-time percentiles (Core.rtPercentiles)
 *   conceptRow   optional mastery row for the question's concept
 *   similarIds   other question ids in the bank that look confusable with q
 *                (same concept, or same signId family) — caller supplies
 * @returns {{kind, label, hint}} hedged classification
 */
function classifyMistake(ctx) {
  const q = ctx.q || {};
  const stat = ctx.stat || {};
  const rtMs = ctx.rtMs;
  const pct = ctx.pct || null;
  const row = ctx.conceptRow || null;
  const similarCount = (ctx.similarIds || []).length;
  const label = ExplainCore ? ExplainCore.classifyResponse(rtMs, !true, pct) : null;
  void label;

  // 1. rushed: quick + wrong against the learner's own pace, and not simply
  //    an unpractised question (first exposure reads as rushed by accident).
  const quick = pct && rtMs != null && rtMs <= pct.p50;
  const seenBefore = (stat.seen || 0) > 1;
  if (quick && !seenBefore) return T.rushed;
  if (quick && seenBefore && stat.correct === 0) return T.rushed;

  // 2. visual/sign confusion: sign-driven question with look-alike signs
  const signDriven = !!(q.signId || (q.signIds && q.signIds.length));
  if (signDriven && similarCount > 0) return T.visual;

  // 3. confusion: similar rule exists and the learner has met it
  if (similarCount > 0 && stat.wrong >= 2) return T.confusion;

  // 4. overthinking: slow + wrong where the concept otherwise holds
  const slow = pct && rtMs != null && rtMs > pct.p75;
  if (slow && row && (row.baseState === "secure" || row.baseState === "strong")) return T.overthinking;

  // 5. lapse: the rule was demonstrated before (clean prior history)
  if (stat.correct >= 2 && stat.wrong <= 1 && stat.fastWrong === 0) return T.lapse;

  // 6. weak concept: the concept as a whole is not holding
  if (row && (row.state === "seen" || row.state === "learning")) return T.weak;

  // 7. wording trap: scenario/photo/what-next forms where the tempting option
  //    hinges on a phrase in the prompt
  if (q.form === "scenario" || q.form === "photo" || q.form === "what-next") return T.wording;

  return T.rule;
}

const T = {
  lapse: { kind: "lapse", label: "likely a memory slip", hint: "You have shown this rule before — this looks like a recall slip rather than a gap." },
  rule: { kind: "rule", label: "likely a rule misunderstanding", hint: "The rule itself may not be solid yet — here it is again, stated plainly." },
  confusion: { kind: "confusion", label: "likely confusion with a similar rule", hint: "Two similar rules may be blending together — the key difference is below." },
  wording: { kind: "wording", label: "likely a wording trap", hint: "The tempting option hangs on one phrase — read what the question is actually asking." },
  visual: { kind: "visual", label: "likely sign confusion", hint: "The sign itself may be the confusion — shape and colour carry the meaning." },
  rushed: { kind: "rushed", label: "answered too quickly", hint: "That answer came fast — a second look at the wording would have caught it." },
  overthinking: { kind: "overthinking", label: "likely overthinking", hint: "You usually know this one — slower answers often mean second-guessing a right instinct." },
  weak: { kind: "weak", label: "weak underlying concept", hint: "The wider concept is still shaky — a short drill on it will help more than re-reading." },
};

/* ---------------- curated distractor traps ---------------- */
/*
 * The bank can name the trap behind each WRONG choice directly. GB questions
 * carry `distractors: { "<choiceIndex>": "<trap tag>" }` — an editorial,
 * per-distractor label written against the Highway Code and the DVSA
 * content list, e.g.
 *
 *   uk-366  sign-combo  min-vs-max-speed
 *           { 1: "min-vs-max-speed", 2: "uk-vs-us-rule", 3: "sign-shape" }
 *
 * This is much stronger evidence than any timing heuristic can produce: it
 * states WHICH misunderstanding the choice was written to catch, rather than
 * guessing one from response time. The heuristic taxonomy below exists for
 * questions with no tag; when the bank has already named the trap, that name
 * wins and the heuristic is not consulted.
 *
 * Each tag maps to plain-English copy. `uk-vs-us-rule` is deliberately
 * jurisdiction-specific: it is the tag for a choice that is true in the United
 * States but false in Great Britain, which is the single most damaging
 * cross-jurisdiction error a GB learner can make.
 */
const DISTRACTOR_TRAPS = {
  "min-vs-max-speed": {
    kind: "confusion",
    label: "minimum and maximum limits reversed",
    hint: "This choice reverses a minimum and a maximum. The shape decides which is which: red ring = maximum, blue circle = minimum.",
  },
  "yellow-line-confusion": {
    kind: "confusion",
    label: "single and double yellow lines confused",
    hint: "This choice treats single and double yellow lines as the same rule. Single yellow means no WAITING during the plate's times; double yellow means no waiting at any time, with no plate.",
  },
  "loading-vs-waiting": {
    kind: "confusion",
    label: "waiting and loading restrictions confused",
    hint: "This choice merges two separate restrictions. Waiting is controlled by the yellow lines; loading and unloading is controlled separately by kerb marks or a plate.",
  },
  "sign-shape": {
    kind: "visual",
    label: "sign shape or colour confused",
    hint: "This choice belongs to a different sign family. In GB sign theory, shape and colour carry the meaning before the symbol does.",
  },
  "speed-assumption": {
    kind: "rule",
    label: "assumed the wrong speed",
    hint: "This choice assumes a limit that the road and the conditions do not give you. A sign states the maximum; your speed must still let you stop within what you can see.",
  },
  "stopping-vs-thinking": {
    kind: "confusion",
    label: "thinking and braking distance confused",
    hint: "This choice swaps the two parts of stopping distance. Thinking distance is the travel during your reaction; braking distance is the travel once the brakes are on.",
  },
  "following-gap": {
    kind: "rule",
    label: "following gap too short",
    hint: "This choice leaves too little room. The gap must cover the whole stopping distance of the vehicle ahead, and it roughly doubles in the wet.",
  },
  "tyre-condition": {
    kind: "rule",
    label: "tyre condition ignored",
    hint: "This choice ignores grip. Worn tyres and poor road surfaces lengthen braking distance regardless of anything else on the road.",
  },
  "normal-weather-in-rain": {
    kind: "rule",
    label: "dry-weather rule applied in rain",
    hint: "This choice applies a dry-weather figure. In rain, braking distances at least double and the usual following gap should double too.",
  },
  "uk-vs-us-rule": {
    kind: "confusion",
    label: "a rule that is not a Great Britain rule",
    hint: "This choice is a common US rule that does not apply here. Good Britain learners meet right-of-way, signage and stopping rules that differ from those in the United States.",
  },
};

/**
 * The bank's own trap name for the choice the learner picked, or null.
 * `pickedIdx` is the index they chose; `q.distractors` maps distractor index
 * → trap tag. A question may tag several choices with the same trap; only the
 * chosen one is ever reported, because that is the error actually made.
 */
function distractorTrap(q, pickedIdx) {
  const d = (q && q.distractors) || null;
  if (!d || pickedIdx == null || pickedIdx < 0) return null;
  const tag = d[String(pickedIdx)];
  if (!tag) return null;
  const def = DISTRACTOR_TRAPS[tag];
  if (!def) return null;
  return { tag, ...def };
}

/**
 * Classify a wrong answer, preferring the bank's curated trap.
 *
 * When the bank names the trap behind the chosen distractor, that label is
 * returned with a `curated: true` flag and no heuristic guess is attached —
 * hedged "you may be…" wording would understate what is actually known about
 * this item. Otherwise the existing timing/structure heuristics run unchanged.
 */
function classifyMistakeWithTrap(ctx) {
  const trap = distractorTrap(ctx && ctx.q, ctx && ctx.pickedIdx);
  if (trap) return Object.assign({}, trap, { curated: true });
  const fallback = classifyMistake(ctx);
  return Object.assign({}, fallback, { curated: false });
}

/* ---------------- coach explanations ---------------- */

/**
 * Plain-English explanation for a recommendation. The structure is always:
 * noticed → matters → do → amount → success. `rec` is a coach candidate
 * (js/coach.js), `ctx` supplies measured numbers the copy interpolates.
 */
function explainRecommendation(rec, ctx) {
  const c = ctx || {};
  const n = (v, d) => (v == null ? d : v);
  switch (rec.type) {
    case "fix-misconception": {
      const name = c.conceptName || "This rule";
      const errors = n(c.errors, rec.evidence && rec.evidence.length ? rec.evidence[0].errors : 0);
      return {
        noticed: `You keep getting ${name} wrong — ${errors} time${errors === 1 ? "" : "s"}${c.fastWrong ? `, ${c.fastWrong} of them answered quickly` : ""}.`,
        matters: "Repeated errors mean two similar rules may be blending together, not that you are careless.",
        doNow: `Compare the two rules side by side, then answer ${rec.questionCount} differently worded questions on ${name}.`,
        amount: `${rec.questionCount} questions · ~${rec.minutes} min`,
        success: `Get ${Math.max(2, Math.ceil(rec.questionCount * 0.75))} variations right in a row without hesitation.`,
      };
    }
    case "review-overdue": {
      const count = n(c.overdue, rec.questionCount);
      return {
        noticed: `${count} question${count === 1 ? "" : "s"} you already learned came up for review and are now overdue.`,
        matters: "Knowledge fades on a schedule — reviews at the right moment are what move facts into long-term memory.",
        doNow: "Run through the due questions. Ones you still know take seconds; the ones you do not come back later.",
        amount: `${rec.questionCount} questions · ~${rec.minutes} min`,
        success: "Answer each due question correctly — anything missed gets its own fresh drill.",
      };
    }
    case "build-coverage": {
      const pct = Math.round(n(c.coverage, 0.5) * 100);
      const untested = n(c.untestedConcepts, null);
      return {
        noticed: untested != null
          ? `You are performing well on the questions you have seen, but ${untested} concept${untested === 1 ? " is" : "s are"} still untested.`
          : `You have covered only ${pct}% of the ${c.scopeLabel || "current"} material.`,
        matters: "Questions you have never met are the cheapest marks available on the real test.",
        doNow: `Answer ${rec.questionCount} questions you have not seen before${c.focusName ? `, starting with ${c.focusName}` : ""}.`,
        amount: `${rec.questionCount} questions · ~${rec.minutes} min`,
        success: `Coverage climbs past ${Math.min(100, pct + Math.round(100 * rec.questionCount / Math.max(1, c.bankSize || rec.questionCount * 6)))}%.`,
      };
    }
    case "improve-fluency": {
      return {
        noticed: `You are getting these right, but answering ${c.slowCount || "several"} concept${(c.slowCount || 2) === 1 ? "" : "s"} much more slowly than your usual correct answers.`,
        matters: "Under test pressure, knowledge you have to work out rather than recall is what slips.",
        doNow: `Do a ${rec.questionCount}-question speed drill${c.conceptName ? ` on ${c.conceptName}` : ""} — aim to recognise the answer, not rebuild it.`,
        amount: `${rec.questionCount} questions · ~${rec.minutes} min`,
        success: "Answers land in your normal quick range, not just correct.",
      };
    }
    case "strengthen-weak-topic": {
      return {
        noticed: `${c.topicName || "This topic"} is sitting at ${Math.round(n(c.mastery, 0.5) * 100)}% mastery across ${c.encounters || "several"} answers — your weakest measured area.`,
        matters: "Topic-level weakness usually means a handful of specific concepts, not the whole subject.",
        doNow: `Answer ${rec.questionCount} questions weighted to the weakest concepts in ${c.topicName || "this topic"}.`,
        amount: `${rec.questionCount} questions · ~${rec.minutes} min`,
        success: `Mastery moves up and at least one weak concept reaches Secure.`,
      };
    }
    case "take-mock": {
      return {
        noticed: c.reason || "Your coverage is solid and no reviews are overdue — a full mock is the most informative next step.",
        matters: "Mocks measure how knowledge holds under real test conditions, which practice cannot.",
        doNow: "Take one timed mock, then turn its misses into a repair session.",
        amount: `${c.mockLabel || "Full mock"} · ${c.mockMinutes || 57} min`,
        success: "A clear picture of what is actually costing you marks.",
      };
    }
    case "light-review": {
      return {
        noticed: c.daysLeft === 0
          ? "It is test day — a few familiar questions keep the rules warm."
          : `Your test is ${c.daysLeft === 1 ? "tomorrow" : "soon"} — the plan is deliberately light.`,
        matters: "Cramming new material the day before adds little; calm recall of what you know is what shows up on the day.",
        doNow: `A short, easy session: ${rec.questionCount} questions on things you already know${c.focusName ? `, especially ${c.focusName}` : ""}.`,
        amount: `${rec.questionCount} questions · ~${rec.minutes} min`,
        success: "Feeling warm, not tired. Then stop.",
      };
    }
    default: { // maintain-strong
      return {
        noticed: "Everything measured is holding strong.",
        matters: "Short recall sessions at spaced intervals are what keep strong knowledge strong.",
        doNow: `A quick mixed session of ${rec.questionCount} questions, oldest reviews first.`,
        amount: `${rec.questionCount} questions · ~${rec.minutes} min`,
        success: "Clean recall across the board — takes a couple of minutes.",
      };
    }
  }
}

/* ---------------- post-answer feedback copy ---------------- */

/**
 * Structured wrong-answer explanation. Returns display-ready strings built
 * from VERIFIED bank content (the question's own why and choices) — never an
 * invented rule. `tempting` names why the picked choice looks right.
 */
function wrongAnswerBreakdown({ q, pickedIdx, mistake, contrast }) {
  const correct = q.choices[q.a];
  const picked = pickedIdx >= 0 ? q.choices[pickedIdx] : null;
  return {
    correctAnswer: correct,
    whyCorrect: q.why,
    whyWrong: picked ? temptingReason(q, pickedIdx, mistake) : null,
    ruleToRemember: firstSentence(q.why),
    commonTrap: contrast ? contrast.text : (mistake ? mistake.hint : null),
    mistake,
  };
}

/**
 * Why a wrong choice is tempting. Built only from the choice's own wording
 * and the hedged taxonomy — never a fabricated rule claim.
 */
function temptingReason(q, pickedIdx, mistake) {
  const choice = q.choices[pickedIdx];
  const short = String(choice).length < 80;
  // A curated trap already names the mistake in plain English. Re-explaining it
  // with a generic opener would throw away the bank's better explanation, so
  // the curated hint is returned on its own.
  if (mistake && mistake.curated) return mistake.hint;
  const openers = {
    confusion: "This choice is the rule most often confused with this one —",
    wording: "This choice looks right if you go by a quick reading —",
    visual: "This choice matches the sign family but not this sign —",
    rushed: "A fast read makes this look right —",
    overthinking: "A careful second look can talk you out of the correct answer and into this one —",
    lapse: "This is the closest neighbour to the correct rule —",
    rule: "This choice states a different rule —",
    weak: "This choice holds up in a different situation than this question describes —",
  };
  const opener = (mistake && openers[mistake.kind]) || openers.rule;
  return short
    ? `${opener} the question is asking for the rule in the situation described, and "${choice}" applies elsewhere.`
    : `${opener} check exactly which situation the question describes before picking it.`;
}

function firstSentence(s) {
  const t = String(s || "").trim();
  const m = t.match(/^[^.!?]+[.!?]/);
  return (m ? m[0] : t).trim();
}

const RoadReadyExplain = {
  T, DISTRACTOR_TRAPS, distractorTrap, classifyMistake, classifyMistakeWithTrap,
  explainRecommendation,
  wrongAnswerBreakdown, temptingReason, firstSentence,
};

if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyExplain;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyExplain = RoadReadyExplain;
