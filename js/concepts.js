/* Road Ready - concept registry (content-quality model).
 *
 * WHY THIS FILE EXISTS
 * -------------------
 * Every question in Road Ready is attached to a CONCEPT - the single rule or
 * idea it tests. Mastery is measured per concept, not per question, so one
 * memorised question can never saturate it. Before this file, questions in
 * js/questions.js carried no `concept` field at all: the engine fell back to
 * `topic:<cat>`, which meant all 84 sign questions collapsed into ONE concept
 * called "topic:signs" and every right answer looked like progress on the same
 * idea. That made the US concept layer useless for diagnosis.
 *
 * This registry does two jobs:
 *   1. QUESTION_CONCEPTS maps every universal US question id to its concept.
 *      Jurisdiction packs already declare `concept` inline, so they are not
 *      duplicated here.
 *   2. CONCEPTS holds the teaching metadata for a concept: a stable display
 *      name, and where the evidence supports it, the governing `rule` and the
 *      tempting wrong interpretation (`watchFor`). The coach uses these to
 *      explain WHY a concept was recommended without inventing a citation.
 *
 * Sourcing: `rule`/`watchFor` are paraphrases of the explanation already
 * carried by the bank's own questions (each of which is provenance-resolved in
 * js/state-packs.js SOURCE_REGISTRY). Nothing here is a new factual claim, and
 * nothing here cites a source that the question it summarises does not cite.
 *
 * HOW IT IS APPLIED
 * -----------------
 * applyConcepts(questions) fills in a missing `concept` from QUESTION_CONCEPTS.
 * It never overwrites an inline concept, so jurisdiction packs always win.
 * Loaded after js/questions.js (browser: classic script; Node: concatenated by
 * scripts/content-loader.mjs as part of the questions.js group).
 */
"use strict";

const CONCEPTS = {
  "traffic-control": {
    name: "Traffic officers and temporary signals",
    rule: "A police officer or authorised traffic officer directing traffic overrides signs and signals.",
    watchFor: "Treating a green light as permission to go when an officer is waving you through a different movement.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "sign-combination": {
    name: "Reading combined signs",
    rule: "When signs are posted together, read them as one message and obey the most restrictive instruction.",
    watchFor: "Reading only the larger sign and missing the plaque or secondary sign that narrows it.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "regulatory-vs-warning": {
    name: "Regulatory vs warning signs",
    rule: "Regulatory signs state a legal requirement; warning signs describe a hazard and never authorise a speed.",
    watchFor: "Driving at the speed shown on a yellow advisory sign and treating it as a limit.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "sign-shapes-and-colours": {
    name: "Sign shapes and colours",
    rule: "Shape and colour carry meaning before you read the words: octagon = stop, triangle = yield, diamond = warning, rectangle = regulation.",
    watchFor: "Reading only the text and ignoring the shape that tells you how the sign must be obeyed.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "traffic-signals": {
    name: "Traffic light signals",
    rule: "Red means stop, yellow means the light is about to change, green means go only when the way is clear.",
    watchFor: "Entering or continuing through an intersection that is already blocked.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "general-sign-awareness": {
    name: "Reading signs you are approaching",
    rule: "Scan ahead for signs and markings and be ready to act well before you reach them.",
    watchFor: "Noticing a sign only when it is too late to comply safely.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "right-of-way": {
    name: "Right of way",
    rule: "Right of way is given, not taken: yield to pedestrians and to whichever road user the rules place ahead of you, and never insist on it.",
    watchFor: "Assuming that being in the right gives you the right to continue when another vehicle is already committed.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "speed-limits": {
    name: "Speed limits and safe speed",
    rule: "A posted limit is a maximum in ideal conditions; the basic speed law still requires a speed that is safe for the conditions.",
    watchFor: "Driving at the limit in fog, rain or heavy traffic and calling it legal, or exceeding the limit to pass.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "space-management": {
    name: "Following distance and space cushion",
    rule: "Keep a following gap of at least two to three seconds, and increase it in rain, dark or when following large vehicles.",
    watchFor: "Matching the car ahead instead of timing a gap, or closing up because a lane is busy.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "stopping-and-braking": {
    name: "Stopping, braking and skids",
    rule: "Braking distance grows with the square of speed, so stop well earlier than feels necessary and never brake hard while a car is sideways.",
    watchFor: "Braking hard mid-skid, or assuming ABS lets you steer and stop at the same time.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "night-driving": {
    name: "Driving at night and in low light",
    rule: "Reduce speed to what you can actually see and stop within, and dip your lights so you do not dazzle others.",
    watchFor: "Using main beam behind an oncoming vehicle and then being unable to see the road yourself.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "cornering": {
    name: "Cornering and bends",
    rule: "Slow to a safe speed BEFORE the bend and accelerate smoothly out of it; never brake hard mid-corner.",
    watchFor: "Braking or steering sharply while already committed to the bend.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "parking-rules": {
    name: "Where you may park and stop",
    rule: "Never park where you would block visibility, a crossing, a hydrant or the travelled way; a red curb means no stopping at all.",
    watchFor: "Stopping in a place that is merely inconvenient rather than illegal and calling it safe.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "alcohol-and-drugs": {
    name: "Alcohol, drugs and driving",
    rule: "Any alcohol impairs driving; only time lowers your blood alcohol concentration, and refusing a lawful test carries its own penalty.",
    watchFor: "Believing coffee, food or a cold shower sobers you up, or that a prescription cannot impair you.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "occupant-protection": {
    name: "Seat belts, airbags and child restraints",
    rule: "Everyone must be properly restrained, children in the correct restraint for their size, and seated far enough back for the airbag.",
    watchFor: "Placing a rear-facing child seat in front of an active airbag.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "vehicle-faults": {
    name: "Vehicle faults and emergencies",
    rule: "If a control fails, keep a firm grip, ease off the gas, and bring the car to a stop under control before trying to fix it.",
    watchFor: "Braking hard during a blowout or a brake failure and losing what control you still have.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "vehicle-maintenance": {
    name: "Vehicle checks and maintenance",
    rule: "Check tyres, lights, wipers and fluid levels regularly so faults are found before they become emergencies.",
    watchFor: "Ignoring a warning light or a slowly losing tyre until it fails on the road.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "observation-and-signalling": {
    name: "Observation, mirrors and signalling",
    rule: "Look early and deliberately - mirrors, blind spot, signal - before you change speed, direction or lane.",
    watchFor: "Assuming a clean mirror check covers the blind spot.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "sharing-the-road": {
    name: "Sharing with pedestrians, cyclists and motorcyclists",
    rule: "Leave extra room around people who are unprotected, and expect them to move unpredictably.",
    watchFor: "Overtaking too close or assuming a cyclist will hold a perfectly straight line.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "emergency-vehicles": {
    name: "Emergency vehicles and work zones",
    rule: "Pull over and stop for an approaching emergency vehicle, and obey flaggers and temporary controls in work zones.",
    watchFor: "Following an emergency vehicle through a red light, or ignoring a flagger because the signal says go.",
    sources: ["us-dmv-handbooks-composite"],
  },

  "licence-and-documents": {
    name: "Licence, documents and legal duties",
    rule: "Carry your licence and insurance, keep your address current, and know your duties after a crash.",
    watchFor: "Driving on a suspended licence, or leaving the scene of even a minor collision.",
    sources: ["us-dmv-handbooks-composite"],
  },
};

/* Universal-bank concept assignments.
 *
 * Keyed by question id from js/questions.js. Grouping is deliberately at the
 * level of the UNDERLYING RULE, so that two questions testing the same rule
 * from different angles land in the same concept and genuinely add evidence,
 * while a question that only rewords another one does not (see
 * scripts/content-checks.mjs, which flags those pairs as trivial variants).
 *
 * The names look granular (e.g. "stop-sign-shape") on purpose: a concept with
 * one question is reported as thin coverage rather than hidden inside a
 * comfortable 300-question topic total. That honesty is the point.
 */
const QUESTION_CONCEPTS = {
  sg01: "stop-sign-response", sg02: "stop-sign-shape", sg03: "yield-sign-meaning", sg04: "do-not-enter-sign", sg05: "wrong-way-sign", sg06: "speed-limit-sign",
  sg07: "regulatory-vs-warning", sg08: "no-u-turn-sign", sg09: "one-way-sign", sg10: "railroad-crossing-sign", sg11: "railroad-crossing-response", sg12: "pedestrian-crossing-sign",
  sg13: "school-zone-sign", sg14: "animal-crossing-sign", sg15: "slippery-road-sign", sg16: "merge-sign", sg17: "divided-highway-sign", sg18: "two-way-traffic-sign",
  sg19: "roundabout-sign", sg20: "work-zone-sign", sg21: "work-zone-authority", sg22: "services-sign", sg23: "no-parking-sign", sg24: "signal-ahead-sign",
  sg25: "stop-ahead-sign", sg26: "bike-crossing-sign", sg27: "chevron-sign", sg28: "keep-right-sign", sg29: "traffic-signals", sg30: "traffic-signals",
  sg31: "traffic-signals", sg32: "stale-green-light", sg33: "centre-line-passing-rule", sg34: "green-arrow-light", sg35: "no-passing-zone-sign", sg36: "hill-sign",
  sg37: "dead-end-sign", sg38: "soft-shoulder-sign", sg39: "no-left-turn-sign", sg40: "school-crossing-vs-zone", sg41: "sign-combination", sg42: "sign-combination",
  sg43: "sign-combination", sg44: "sign-combination", sg45: "sign-combination", sg46: "sign-combination", rw01: "four-way-stop-simultaneous", rw02: "left-turn-priority",
  rw03: "private-drive-yield", rw04: "emergency-vehicle-approach", rw05: "blind-pedestrian-priority", rw06: "uncontrolled-intersection-tie", rw07: "t-intersection-priority", rw08: "crosswalk-pedestrian-priority",
  rw09: "school-bus-undivided", rw10: "school-bus-divided", rw11: "roundabout-entry-yield", rw12: "freeway-merge-priority", rw13: "reversing-yield", rw14: "blocked-intersection",
  rw15: "turn-across-bike-lane", rw16: "stopped-emergency-vehicle", rw17: "headlight-flash-response", rw18: "blind-pedestrian-signal", rw19: "narrow-road-priority", rw20: "left-on-red",
  rw21: "right-turn-pedestrian-yield", sp01: "basic-speed-law", sp02: "following-distance-seconds", sp03: "passing-and-speed-limit", sp04: "speed-and-stopping-distance", sp05: "hydroplaning",
  sp06: "freeway-entrance-ramp", sp07: "fog-driving", sp08: "hill-crest-speed", sp09: "slow-driving-hazard", sp10: "work-zone-speed", sp11: "truck-following-downgrade",
  sp12: "advisory-speed-sign", sp13: "passing-distance", sp14: "night-driving-risk", sp15: "stopping-distance-components", sp16: "following-distance-seconds", pk01: "hill-parking-wheels",
  pk02: "hill-parking-wheels", pk03: "parallel-parking-curb-distance", pk04: "illegal-parking", pk05: "fire-hydrant-distance", pk06: "exiting-parked-car", pk07: "curb-colours",
  pk08: "curb-colours", pk09: "highway-shoulder-stop", pk10: "leaving-parking-space", pk11: "illegal-parking", pk12: "one-way-parking-side", pk13: "hill-parking-rationale",
  al01: "bac-legal-limit", al02: "under-21-alcohol-limit", al03: "bac-reduction-myth", al04: "alcohol-first-effect", al05: "standard-drink-equivalence", al06: "implied-consent-refusal",
  al07: "open-container-law", al08: "dui-penalties", al09: "medicine-and-driving", al10: "marijuana-and-driving", al11: "drink-driving-planning", al12: "bac-determining-factors",
  al13: "dui-penalties", sf01: "seat-belt-law", sf02: "airbag-and-child-seat-distance", sf03: "headlight-use-required", sf04: "high-beam-dimming", sf05: "oncoming-headlight-glare",
  sf06: "skid-recovery", sf07: "brake-failure", sf08: "tyre-blowout", sf09: "stuck-accelerator", sf10: "engine-stall", sf11: "crash-scene-first-action",
  sf12: "unattended-vehicle-damage", sf13: "texting-while-driving", sf14: "truck-no-zones", sf15: "blind-spot-checks", sf16: "motorcycle-sharing-lane", sf17: "oncoming-vehicle-drift",
  sf18: "child-restraint-seat", sf19: "carbon-monoxide-risk", sf20: "drowsy-driving", sf21: "tailgating-response", sf22: "aggressive-driver-response", sf23: "animal-on-road",
  sf24: "collision-information-exchange", lw01: "documents-to-carry", lw02: "address-change-notification", lw03: "crash-duty-to-stop", lw04: "right-turn-on-red", lw05: "signalling-requirement",
  lw06: "u-turn-legality", lw07: "solid-white-line-crossing", lw08: "reckless-driving", lw09: "licence-points", lw10: "hov-lane-use", lw11: "police-pull-over",
  lw12: "suspended-licence", lw13: "littering", lw14: "headphones-while-driving", lw15: "gps-while-driving", mk01: "broken-yellow-line", mk02: "double-solid-yellow",
  mk03: "solid-white-lane-line", mk04: "line-colour-system", mk05: "two-way-left-turn-lane", mk06: "bike-lane-use", mk07: "crosswalk-markings", mk08: "stop-line-marking",
  mk09: "hov-lane-marking", mk10: "gore-area", mk11: "railroad-crossbuck", mk12: "lane-arrow-marking", mk13: "passing-on-the-right", mk14: "raised-pavement-markers",
  mk15: "lane-end-merge", vr02: "cyclist-swerve", vr03: "group-of-cyclists", vr04: "motorcycle-lane-sharing", vr05: "motorcycle-position-in-lane", vr06: "motorcycle-indicators",
  vr07: "motorcycle-visibility", vr08: "pedestrian-against-signal", vr09: "ball-into-street", vr10: "elderly-pedestrian", vr11: "crossing-guard-authority", vr12: "e-scooter-in-bike-lane",
  vr13: "horse-and-rider", vr14: "parked-car-door-risk", vh01: "pre-drive-adjustment", vh02: "mirror-limits", vh03: "abs-emergency-braking", vh04: "tyre-pressure-source",
  vh05: "tyre-tread-test", vh06: "brake-pedal-fault", vh07: "horn-use", vh08: "frost-clearance", vh09: "loose-objects", vh10: "reversing-camera",
  vh11: "steering-hand-position", vh12: "uphill-stop-in-traffic", vh13: "fuel-reserve", vh14: "wiper-condition", vh15: "headlight-failure",
};

/* ---------------- application ---------------- */

/** Fill a missing `concept` on each question from the registry.
 *  Questions that already declare one (all jurisdiction packs) are untouched. */
function applyConcepts(questions) {
  if (!Array.isArray(questions)) return 0;
  let applied = 0;
  for (const q of questions) {
    if (!q || q.concept) continue;
    const key = QUESTION_CONCEPTS[q.id];
    if (key) { q.concept = key; applied++; }
  }
  return applied;
}

// Auto-apply when this file is loaded after the bank in the same scope, which
// is how the browser loads it (classic script) and how the Node toolchain
// concatenates it (scripts/content-loader.mjs). Guarded so a standalone
// require() of this file in isolation does not throw.
try {
  if (typeof QUESTIONS !== "undefined" && Array.isArray(QUESTIONS)) applyConcepts(QUESTIONS);
} catch { /* QUESTIONS not in scope - fine, applyConcepts() is callable */ }

/* ---------------- lookup helpers ---------------- */

/** Stable, human-readable name for a concept, falling back to the key itself. */
function conceptName(key) {
  if (!key || typeof key !== "string") return "General";
  const meta = CONCEPTS[key];
  if (meta && meta.name) return meta.name;
  return key
    .replace(/^topic:/, "")
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Full teaching metadata for a concept: name, rule, the tempting wrong
 *  interpretation, and the sources that back them (inherited from the pack or
 *  the universal defaults when the concept itself does not override).
 *
 *  When a concept has no curated entry, the rule falls back to the explanation
 *  the bank's OWN questions carry for it — which is already provenance-
 *  resolved and reviewed by content QA. That keeps the feedback panel useful
 *  for every concept without inventing a single new sentence, and the source
 *  attribution stays exactly as accurate as the question the learner just
 *  answered. `watchFor` has no such safe fallback and stays null. */
function conceptMeta(key, jurisdiction) {
  if (!key || typeof key !== "string") return null;
  const base = CONCEPTS[key] || null;
  let sources = base && base.sources;
  let authority = null;
  let jurisdictionName = null;
  if (jurisdiction && jurisdiction !== "generic") {
    const pack = (typeof STATE_PACKS !== "undefined" && STATE_PACKS) ? STATE_PACKS[jurisdiction] : null;
    if (pack && pack.sourceId && typeof SOURCE_REGISTRY !== "undefined") {
      const src = SOURCE_REGISTRY[pack.sourceId];
      if (src) { authority = src.agency; jurisdictionName = jurisdiction; }
    }
  }
  const name = (base && base.name) || conceptName(key);
  const rule = (base && base.rule) || explanationFor(key) || null;
  const watchFor = (base && base.watchFor) || null;
  return {
    key,
    name,
    rule,
    watchFor,
    sources: sources || null,
    authority,
    jurisdiction: jurisdictionName,
    curated: !!(base && base.rule),
  };
}

/** First explanation in the bank that covers this concept, or null.
 *  Searches the universal bank first, then the jurisdiction pack the learner
 *  actually has selected — the pack's own questions are the most relevant
 *  wording for a pack-specific rule. */
function explanationFor(key) {
  const fromUniversal = firstExplanation(typeof QUESTIONS !== "undefined" ? QUESTIONS : [], key);
  if (fromUniversal) return fromUniversal;
  if (typeof STATE_PACKS !== "undefined" && STATE_PACKS && typeof key === "string") {
    for (const packId of Object.keys(STATE_PACKS)) {
      const pack = STATE_PACKS[packId];
      const hit = pack && Array.isArray(pack.questions)
        ? firstExplanation(pack.questions, key)
        : null;
      if (hit) return hit;
    }
  }
  return null;
}

function firstExplanation(questions, key) {
  if (!Array.isArray(questions)) return null;
  for (const q of questions) {
    if (q && q.concept === key && q.why) return q.why;
  }
  return null;
}

/** Distinct concepts used by a set of questions, sorted by first appearance. */
function conceptsOf(questions) {
  const seen = new Set();
  const out = [];
  for (const q of questions || []) {
    const key = (q && q.concept) || (q ? `topic:${q.cat}` : null);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

const RoadReadyConcepts = { CONCEPTS, QUESTION_CONCEPTS, applyConcepts, conceptName, conceptMeta, conceptsOf, explanationFor };
if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyConcepts;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyConcepts = RoadReadyConcepts;

