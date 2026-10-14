/* Road Ready — state-specific content packs.
 *
 * Content model:
 *   Universal concepts  — js/questions.js (no jurisdiction tag): signs,
 *                         hazard recognition, positioning, following distance,
 *                         basic right-of-way. Rules common across states.
 *   Jurisdiction layer  — below. Each pack carries its own question set
 *                         (jurisdiction:["XX"], concept, sourceId/sourceSection)
 *                         plus key-fact overrides shown in the study guide.
 * The selected pack (settings.statePack) filters the active bank and swaps the
 * facts card. "generic" = universal questions only.
 */
"use strict";

/* The Great Britain pack ships as its own data module (js/packs/uk.js) so a
   ~1500-question bank does not bury this file. Under Node — where tooling
   and tests import THIS file on its own — require it synchronously. In the
   browser the pack loads on demand (see ensureUkPack): parsing 1.6MB of
   questions on every boot would tax exactly the low-end mobile devices many
   learners study on, and most sessions never select Great Britain. Until the
   pack arrives, STATE_PACKS.UK is a correctly-shaped placeholder (name and
   static metadata resolve; the question list is empty), so pack listings and
   the jurisdiction tree render without special cases. Any flow that switches
   the active pack to UK must await ensureUkPack() first. */
const UK_PLACEHOLDER = {
  name: "Great Britain (DVSA)",
  questions: [],
  facts: {},
  includeUniversal: false,
};
let ukPack = null;
if (typeof ROADREADY_UK_PACK !== "undefined") {
  ukPack = ROADREADY_UK_PACK;
} else if (typeof module !== "undefined" && module.exports && typeof require === "function") {
  // Node test/CLI context (CJS): the pack module is required directly. In the
  // browser `require` is undefined, so this branch never runs there — and the
  // lint model for classic scripts deliberately has no `process` global.
  ukPack = require("./packs/uk.js");
}
/* In-flight load promise (browser only): exactly one fetch per session. */
let ukLoadPromise = null;
/** True once the GB question bank is available to the bank builders. */
function ukLoaded() { return !!(ukPack && Array.isArray(ukPack.questions) && ukPack.questions.length); }
/** Load the GB pack on demand. Resolves to the pack; rejects while offline
    with the pack still unloaded, so callers can keep the previous pack and
    say so honestly. Works from http(s) via dynamic import and from file://
    via a classic script tag (module import is CORS-blocked on file://). */
function notifyUkReady() {
  // The bank builders (ALL_QUESTIONS in app.js) snapshot this module's packs
  // at parse time, so a pack that arrives later must announce itself —
  // otherwise the idle preload below would load 1.6MB to no effect and any
  // setup view rendered mid-load would keep showing an empty bank.
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event("roadready:uk-ready"));
    }
  } catch { /* event is best-effort; explicit callers refresh directly */ }
}
function ensureUkPack() {
  if (ukLoaded()) return Promise.resolve(ukPack);
  if (ukLoadPromise) return ukLoadPromise;
  // Dynamic import() in a classic script resolves against the document base
  // URL (not this file), so build the URL from baseURI explicitly — a bare
  // "./packs/uk.js" would request /packs/uk.js and 404 off every page.
  const ukUrl = (typeof document !== "undefined" && document.baseURI)
    ? new URL("js/packs/uk.js", document.baseURI).href
    : "./packs/uk.js";
  ukLoadPromise = (typeof document !== "undefined" && document.baseURI && document.baseURI.startsWith("file:")
    ? loadUkViaScriptTag()
    : import(ukUrl).catch(loadUkViaScriptTag)
  ).then(() => {
    const pack = typeof ROADREADY_UK_PACK !== "undefined"
      ? ROADREADY_UK_PACK
      : (typeof globalThis !== "undefined" ? /** @type {any} */ (globalThis).ROADREADY_UK_PACK || null : null);
    if (!pack || !Array.isArray(pack.questions) || !pack.questions.length) {
      ukLoadPromise = null;
      throw new Error("GB pack failed to load");
    }
    ukPack = pack;
    notifyUkReady();
    return ukPack;
  }, (err) => {
    ukLoadPromise = null;
    throw err;
  });
  return ukLoadPromise;
}
function loadUkViaScriptTag() {
  return new Promise((resolve, reject) => {
    try {
      const s = document.createElement("script");
      s.src = "js/packs/uk.js";
      s.onload = () => resolve(undefined);
      s.onerror = () => reject(new Error("GB pack failed to load"));
      document.head.appendChild(s);
    } catch (err) {
      reject(err);
    }
  });
}
/* Warm the cache for the likely-GB session: fire the load in the background
   at parse time so selecting Great Britain usually finds it already here.
   Failures are silent — the explicit ensureUkPack() at selection time is the
   path that reports them. */
if (typeof window !== "undefined" && typeof document !== "undefined" &&
    !(document.baseURI && document.baseURI.startsWith("file:"))) {
  const idle = typeof window.requestIdleCallback === "function"
    ? (fn) => window.requestIdleCallback(fn)
    : (fn) => setTimeout(fn, 1500);
  idle(() => { ensureUkPack().catch(() => { /* reported at selection time */ }); });
}

/* Primary-source registry. Every jurisdictional question must resolve to one
   of these issuing-agency resources; content QA enforces the relationship. */
const SOURCE_REGISTRY = {
  "ca-dmv-driver-handbook": {
    jurisdiction: "CA", agency: "California DMV", title: "California Driver's Handbook",
    url: "https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/", verified: "2026-08-23",
  },
  "tx-dps-driver-handbook": {
    jurisdiction: "TX", agency: "Texas DPS", title: "Texas Driver Handbook",
    url: "https://www.dps.texas.gov/InternetForms/home/Details/304", verified: "2026-08-23",
  },
  "ny-dmv-driver-manual": {
    jurisdiction: "NY", agency: "New York DMV", title: "New York State Driver's Manual",
    url: "https://dmv.ny.gov/book/export/html/1551", verified: "2026-08-23",
  },
  "fl-flhsmv-handbook": {
    jurisdiction: "FL", agency: "FLHSMV", title: "Official Florida Driver License Handbook",
    url: "https://www.flhsmv.gov/pdf/handbooks/englishdriverhandbook.pdf", verified: "2026-08-23",
  },
  "wa-dol-driver-guide": {
    jurisdiction: "WA", agency: "Washington DOL", title: "Washington State Driver Guide",
    url: "https://dol.wa.gov/driver-licenses-and-permits/driver-training-and-testing/driver-guides/washington-state-driver-guide-text-only", verified: "2026-08-23",
  },
  "pa-penndot-driver-manual": {
    jurisdiction: "PA", agency: "PennDOT", title: "Pennsylvania Driver's Manual",
    url: "https://www.pa.gov/agencies/dmv/driver-services/pennsylvania-drivers-manual", verified: "2026-08-23",
  },
  "uk-highway-code": {
    jurisdiction: "UK", agency: "Department for Transport", title: "The Highway Code",
    url: "https://www.gov.uk/guidance/the-highway-code", verified: "2026-09-22",
  },
  "uk-know-your-traffic-signs": {
    jurisdiction: "UK", agency: "Department for Transport", title: "Know Your Traffic Signs",
    url: "https://www.gov.uk/government/publications/know-your-traffic-signs", verified: "2026-09-22",
  },
  "uk-theory-test-format": {
    jurisdiction: "UK", agency: "DVSA", title: "Theory test: cars — multiple-choice format",
    url: "https://www.gov.uk/theory-test/multiple-choice-questions", verified: "2026-09-22",
    note: "50 questions and 57 minutes are stated on this page; the 43/50 pass mark was independently re-verified on GOV.UK's pass-mark page on 2026-09-22.",
  },
  "us-dmv-handbooks-composite": {
    jurisdiction: "*", agency: "Multiple state DMVs (composite)",
    title: "U.S. state driver handbooks — commonly taught rules",
    edition: "2025–2026 editions", verified: "2026-08-23",
    citationLabel: "Reference basis",
    note: "Cites the universal bank: rules taught consistently across state handbooks. State exceptions live in jurisdiction packs.",
  },
};

/* Explicit, reviewed per-category citations for the universal bank. This table
   IS the provenance for universal questions — configuration, never a silent
   tooling fallback. A question whose cat has no entry here FAILS content QA. */
const UNIVERSAL_DEFAULTS = {
  signs:      { sourceId: "us-dmv-handbooks-composite", section: "Traffic Signs and Signals" },
  markings:   { sourceId: "us-dmv-handbooks-composite", section: "Pavement Markings" },
  row:        { sourceId: "us-dmv-handbooks-composite", section: "Right of Way" },
  speed:      { sourceId: "us-dmv-handbooks-composite", section: "Speed Limits and Safe Speed" },
  parking:    { sourceId: "us-dmv-handbooks-composite", section: "Parking and Stopping" },
  alcohol:    { sourceId: "us-dmv-handbooks-composite", section: "Alcohol and Drugs" },
  safety:     { sourceId: "us-dmv-handbooks-composite", section: "Safe Driving and Emergencies" },
  vulnerable: { sourceId: "us-dmv-handbooks-composite", section: "Sharing the Road" },
  vehicle:    { sourceId: "us-dmv-handbooks-composite", section: "Vehicle Equipment and Maintenance" },
  laws:       { sourceId: "us-dmv-handbooks-composite", section: "Licensing, Documents and Penalties" },
};

/* How fresh a source verification must be (days). Older = CI failure. */
const VERIFICATION_MAX_AGE_DAYS = 365;

/* Which fact-table column guards which concept — used by the fact-consistency
   checker to cross-examine state-specific answers against pack facts. */
const CONCEPT_FACT_KEYS = {
  "bac-limits":         ["bacAdult"],
  "zero-tolerance":     ["bacUnder21"],
  "following-distance": ["followDistance"],
  "school-bus":         ["schoolBus"],
  "right-on-red":       ["rightOnRed"],
  "speed-limits":       ["speedResidential", "speedUrban"],
  "phone-use":          ["handsFree", "handheldPhone", "distractedDriving", "textingBan"],
  "distracted-driving": ["distractedDriving", "handsFree", "handheldPhone"],
  "move-over":          ["moveOver"],
  "bike-passing-distance": ["bikePassing"],
  "work-zones":         ["workZone"],
};

const STATE_PACKS = {
  generic: {
    id: "generic",
    includeUniversal: true,
    name: "General U.S. rules",
    note: "Follows rules common across state DMV handbooks. Confirm specifics with your official handbook.",
    facts: {
      bacAdult: "0.08%",
      bacUnder21: "zero tolerance (any measurable amount)",
      followDistance: "3-second rule",
      rightOnRed: "Allowed after a complete stop unless posted otherwise",
      schoolBus: "Stop in both directions when red lights flash (divided highways may exempt oncoming traffic)",
    },
    questions: [],
  },
  CA: {
    id: "CA",
    name: "California (DMV)",
    sourceId: "ca-dmv-driver-handbook",
    facts: {
      bacAdult: "0.08% (0.04% for commercial drivers)",
      bacUnder21: "0.01% or more — zero tolerance",
      followDistance: "3-second rule",
      rightOnRed: "Allowed after a complete stop unless a sign prohibits it",
      schoolBus: "Stop in both directions on undivided roads when red lights flash",
      speedResidential: "25 mph",
      speedUrban: "55 mph on two-lane undivided highways; 65 mph maximum on freeways unless posted otherwise",
        bikePassing: "At least 3 feet when passing a bicycle",
      handsFree: "No handheld phone use at all for drivers 18+; under-18 drivers may not use a phone even hands-free",
      moveOver: "Move over a lane or slow to a reasonable speed for stopped emergency vehicles with flashing lights",
      workZone: "Fines doubled in highway work zones",
    },
    questions: [
      { id: "ca-001", cat: "alcohol", jurisdiction: ["CA"], concept: "zero-tolerance",
        q: "In California, a driver under 21 may be cited for DUI with a BAC of:",
        choices: ["0.08% or more", "0.05% or more", "0.01% or more — any measurable amount", "There is no limit for minors"],
        a: 2,
        why: "California's zero-tolerance law (Vehicle Code §23136) suspends the license of any driver under 21 measuring 0.01% BAC or more — essentially one drink. Drivers 21+ are held to the 0.08% limit.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Alcohol and Drugs" },
      { id: "ca-002", cat: "alcohol", jurisdiction: ["CA"], concept: "bac-limits",
        q: "A California commercial driver operates under a BAC limit of:",
        choices: ["0.08%", "0.04%", "0.10%", "The same limit as other drivers"],
        a: 1,
        why: "Commercial drivers in California are limited to 0.04% BAC — half the standard 0.08% limit — because of the size and risk of the vehicles they operate.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Commercial Licenses" },
      { id: "ca-003", cat: "speed", jurisdiction: ["CA"], concept: "speed-limits",
        q: "Unless a posted sign says otherwise, the speed limit in a California residential district is:",
        choices: ["30 mph", "25 mph", "20 mph", "35 mph"],
        a: 1,
        why: "California's default residential/business-district speed limit is 25 mph when no sign posts a different number. Blanket limits like this apply where you see no signage.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Traffic Controls" },
      { id: "ca-004", cat: "laws", jurisdiction: ["CA"], concept: "phone-use",
        q: "A California driver under 18 who holds a provisional license may use a phone while driving:",
        choices: ["Only with a hands-free device", "Only at a red light", "Never — not even hands-free", "Only for navigation"],
        a: 2,
        why: "Under-18 provisional licensees in California may not use a phone at all while driving, even hands-free — the distraction, not just the handset, is the hazard. Drivers 18+ may use hands-free only.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Distractions" },
      { id: "ca-005", cat: "vulnerable", jurisdiction: ["CA"], concept: "school-bus",
        q: "On an undivided California road, a school bus flashes red lights as children board. You must:",
        choices: ["Pass slowly on the left", "Stop in both directions until the lights stop", "Stop only if you are behind the bus", "Slow to 25 mph and continue"],
        a: 1,
        why: "On undivided roads, traffic in BOTH directions must stop for a school bus flashing red lights and remain stopped until the lights stop flashing. Only divided-highway oncoming traffic may continue.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "School Buses" },
      { id: "ca-006", cat: "row", jurisdiction: ["CA"], concept: "right-on-red",
        q: "At a California red light with no prohibiting sign, you may turn right after:",
        choices: ["Slowing to 10 mph", "Coming to a complete stop and yielding", "Waiting for one full cycle", "Flashing your headlights"],
        a: 1,
        why: "Right on red is legal in California unless a sign prohibits it — but only after a COMPLETE stop and yielding to pedestrians and cross traffic. A rolling 'California stop' is still a violation.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Right of Way" },
        { id: "ca-007", cat: "vulnerable", jurisdiction: ["CA"], concept: "bike-passing-distance",
          q: "Under California law, when you pass a bicycle you must leave at least:",
          choices: ["1 foot of clearance", "2 feet of clearance", "3 feet of clearance", "A car's length"],
          a: 2,
          why: "California requires AT LEAST THREE FEET between your vehicle and a bicycle when passing — and to slow further if you cannot get that far over.",
          sourceId: "ca-dmv-driver-handbook", sourceSection: "Sharing the Road" },
      { id: "ca-008", cat: "speed", form: "recall", jurisdiction: ["CA"], concept: "speed-limits",
        q: "What is the maximum speed limit on most California freeways unless signs post otherwise?",
        choices: ["65 mph", "70 mph", "55 mph", "75 mph"],
        a: 0,
        why: "The statewide freeway maximum is 65 mph where no lower limit is posted — unlike the 25 mph residential default, freeways assume high design speeds, so the 65 mph cap balances flow against stopping distance.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Speed Limits" },
      { id: "ca-009", cat: "speed", form: "scenario", jurisdiction: ["CA"], concept: "speed-limits",
        q: "You are towing a trailer on a California two-lane undivided highway. Which limit applies unless posted otherwise?",
        choices: ["65 mph", "55 mph", "45 mph", "70 mph"],
        a: 1,
        why: "Two-lane undivided highways cap at 55 mph, and vehicles towing trailers hold to 55 mph even on faster roads — the lower 55 mph figure reflects narrow lanes, oncoming traffic, and trailer sway.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Speed Limits" },
      { id: "ca-010", cat: "speed", form: "recall", jurisdiction: ["CA"], concept: "speed-limits",
        q: "Approaching a blind intersection with about 100 feet of visibility and no signs, California's prima-facie limit is:",
        choices: ["25 mph", "20 mph", "15 mph", "10 mph"],
        a: 2,
        why: "Blind intersections and alleys default to 15 mph — far below the familiar 25 mph residential figure — because cross traffic can appear with almost no warning at such corners.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Speed Limits" },
      { id: "ca-011", cat: "parking", form: "recall", jurisdiction: ["CA"], concept: "parking-at-curb",
        q: "When parallel parking on a level California street, how far from the curb may your wheels be?",
        choices: ["Within 24 inches", "Within 6 inches", "Any distance if straight", "Within 18 inches"],
        a: 3,
        why: "California requires parked wheels within 18 inches of the curb or road edge on level streets — close enough that cyclists and passing cars keep a clear lane.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
      { id: "ca-012", cat: "parking", form: "recall", jurisdiction: ["CA"], concept: "parking-near-fire-station",
        q: "You want to park opposite a California fire station entrance. How far from either side of the entrance must you stay clear?",
        choices: ["5 feet", "15 feet", "25 feet", "50 feet"],
        a: 1,
        why: "Keep 15 feet clear on both sides of a fire-station driveway so engines can swing out — the same 15-foot rule also covers fire hydrants.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Parking" },
      { id: "ca-013", cat: "vulnerable", form: "scenario", jurisdiction: ["CA"], concept: "motorcycle-lane-splitting",
        q: "In slow California traffic, a motorcyclist filters between your lane and the next. This lane-splitting is:",
        choices: ["Always illegal", "Legal only on freeways", "Legal when done safely and prudently", "Legal only for police riders"],
        a: 2,
        why: "California is the only state where lane-splitting is expressly permitted — riders may filter between lanes in slow traffic when they do it safely and prudently, without excessive speed difference.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Sharing the Road" },
      { id: "ca-014", cat: "laws", form: "scenario", jurisdiction: ["CA"], concept: "hov-lane-use",
        q: "A California carpool (HOV) lane posts '2+'. At rush hour you drive alone. You may enter that lane:",
        choices: ["Never while the restriction applies", "To pass one slow truck", "Within 500 feet of your exit", "When traffic beside you stops"],
        a: 0,
        why: "A posted HOV restriction is absolute while it applies — a lone driver never qualifies for a 2+ carpool lane, not for passing, exiting early, or escaping stopped traffic.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Carpool Lanes" },
      { id: "ca-015", cat: "safety", form: "recall", jurisdiction: ["CA"], concept: "child-restraint",
        q: "Your 6-year-old (4 ft 5 in) rides in the back of your California car. The law requires:",
        choices: ["A seat belt only", "No restraint in back seats", "Front seat with airbag on", "A booster or car seat in the back seat"],
        a: 3,
        why: "Children under 8 must ride in an approved child seat in the rear — adult belts alone fit small bodies badly, and front airbags can injure young passengers.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Occupant Protection" },
      { id: "ca-016", cat: "laws", form: "recall", jurisdiction: ["CA"], concept: "provisional-license",
        q: "With a California provisional license (under 18, first 12 months), you may NOT:",
        choices: ["Drive to school alone", "Drive between 11 pm and 5 am unsupervised", "Listen to the radio", "Carry groceries"],
        a: 1,
        why: "Provisional drivers face a nighttime curfew — no unsupervised driving between 11 pm and 5 am during the first year — plus a ban on passengers under 20 without a licensed adult aged 25 or older aboard.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Licensing" },
      { id: "ca-017", cat: "laws", form: "scenario", jurisdiction: ["CA"], concept: "move-over",
        q: "A tow truck with flashing amber lights works on the shoulder ahead. You cannot change lanes. You should:",
        choices: ["Keep your speed", "Stop dead in your lane", "Slow to a reasonable speed and pass with care", "Sound your horn continuously"],
        a: 2,
        why: "California's move-over rule says to change lanes away from stopped emergency and service vehicles showing flashing lights — or, when blocked, slow to a reasonable speed and give the crew as much room as possible.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Sharing the Road" },
      { id: "ca-018", cat: "laws", form: "recall", jurisdiction: ["CA"], concept: "work-zones",
        q: "Fines for traffic violations in a marked California highway work zone are:",
        choices: ["Doubled", "Halved", "Unchanged", "Waived for locals"],
        a: 0,
        why: "Work-zone fines are doubled where workers are present and signs are posted — the doubled fine reflects that a moment's inattention can kill someone standing feet from traffic.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Work Zones" },
      { id: "ca-019", cat: "safety", form: "recall", jurisdiction: ["CA"], concept: "headlight-use",
        q: "California requires headlights from half an hour after sunset to half an hour before sunrise, and also when:",
        choices: ["Parking at the curb", "Using the radio", "Driving with passengers", "Whenever wipers run in poor visibility"],
        a: 3,
        why: "Wipers-on means lights-on: when rain, fog, or smoke forces continuous wiper use, the headlights must burn too so oncoming drivers spot you through the murk.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Safe Driving" },
      { id: "ca-020", cat: "laws", form: "scenario", jurisdiction: ["CA"], concept: "bike-lane-turns",
        q: "To turn right at a California intersection, a solid bike lane runs up to the junction. You should:",
        choices: ["Turn across it from your lane", "Merge into the bike lane within 200 feet, yield to bikes, then turn", "Stop and wait for all bikes to pass", "Turn from the left lane"],
        a: 1,
        why: "Slide into the bike lane in the last 200 feet after yielding to riders, then complete the turn from the lane — the short merge keeps turning cars from hooking cyclists.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Turning" },
      { id: "ca-021", cat: "laws", form: "recall", jurisdiction: ["CA"], concept: "littering-fine",
        q: "Tossing a lit cigarette from your car on a California highway brings:",
        choices: ["A thank-you note", "A warning only", "A fine near $1,000 plus possible cleanup liability", "No penalty off freeways"],
        a: 2,
        why: "Highway littering fines in California reach about $1,000 — and a lit cigarette adds fire liability in dry brush season, when one butt can start a wildfire.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Littering" },
      { id: "ca-022", cat: "safety", form: "recall", jurisdiction: ["CA"], concept: "signal-distance",
        q: "Before turning or changing lanes in California, you must signal continuously for at least:",
        choices: ["100 feet", "50 feet", "10 feet", "500 feet"],
        a: 0,
        why: "Signal at least 100 feet before the turn or lane change — the 100-foot rule gives drivers behind you time to react rather than guess.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Signaling" },
      { id: "ca-023", cat: "vulnerable", form: "scenario", jurisdiction: ["CA"], concept: "pedestrian-crosswalk",
        q: "At an unmarked California crosswalk (sidewalk lines extended across the street), a pedestrian steps off the curb. You must:",
        choices: ["Wave them back", "Swerve around them", "Speed up to clear first", "Stop and let them cross"],
        a: 3,
        why: "Every intersection is a legal crosswalk in California, marked or not — drivers must stop for pedestrians crossing within it and wait until they clear your half of the road.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Pedestrians" },
      { id: "ca-024", cat: "laws", form: "recall", jurisdiction: ["CA"], concept: "dui-penalties",
        q: "A first-time California DUI conviction (21+) typically brings about 6 months of license suspension plus:",
        choices: ["A medal", "A 3-month DUI program, fines, and possible ignition-interlock time", "Nothing further", "Free insurance"],
        a: 1,
        why: "A first DUI typically means roughly a 6-month suspension, thousands in fines and penalty assessments, a months-long DUI program, and possible ignition-interlock restriction before full restoration.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Alcohol and Drugs" },
      { id: "ca-025", cat: "row", form: "scenario", jurisdiction: ["CA"], concept: "roundabout-yield",
        q: "Entering a California single-lane roundabout with traffic already circulating, you must:",
        choices: ["Enter first — size wins", "Stop on entry no matter what", "Yield to traffic in the circle, entering when clear", "Turn left against the flow"],
        a: 2,
        why: "Roundabout entries always yield to traffic already in the circle — wait for a safe gap, enter to the right, and never stop inside the circulating lane.",
        sourceId: "ca-dmv-driver-handbook", sourceSection: "Intersections" },
    ],
  },
  TX: {
    id: "TX",
    name: "Texas (DPS)",
    sourceId: "tx-dps-driver-handbook",
    facts: {
      bacAdult: "0.08%",
      bacUnder21: "any detectable amount",
      followDistance: "2-second minimum, more at speed or in rain",
      rightOnRed: "Allowed after a complete stop unless posted otherwise",
      schoolBus: "Stop in both directions on any road unless a physical barrier divides them",
        speedUrban: "30 mph default in cities unless posted",
        speedResidential: "30 mph in urban districts unless posted",
        speedRural: "70 mph by day / 65 mph at night on numbered highways outside cities",
        moveOver: "Move over a lane or slow to 20 mph below the limit for stopped emergency vehicles",
        workZone: "Fines doubled in work zones when workers are present",
        textingBan: "Texting while driving is illegal for ALL drivers statewide",
    },
    questions: [
      { id: "tx-001", cat: "alcohol", jurisdiction: ["TX"], concept: "zero-tolerance",
        q: "Under Texas zero-tolerance law, a driver under 21 commits an offense with:",
        choices: ["A BAC of 0.08%", "Any detectable amount of alcohol", "A BAC above 0.04%", "Open containers in the trunk"],
        a: 1,
        why: "Texas forbids ANY detectable amount of alcohol for drivers under 21 — there is no minimum threshold like the adult 0.08% limit.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Alcohol and Drug Impact" },
      { id: "tx-002", cat: "speed", jurisdiction: ["TX"], concept: "speed-limits",
        q: "In a Texas city street with no posted speed limit, the urban district limit is generally:",
        choices: ["25 mph", "30 mph", "40 mph", "55 mph"],
        a: 1,
        why: "Texas urban districts default to 30 mph unless signage posts otherwise. Rural highways carry higher defaults — always look for signs first.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Signs, Signals and Markings" },
      { id: "tx-003", cat: "vulnerable", jurisdiction: ["TX"], concept: "school-bus",
        q: "A Texas school bus stops with red lights flashing on a road separated by a raised concrete median. Oncoming traffic:",
        choices: ["Must stop in both directions", "May continue if separated by a physical barrier", "Must slow to 15 mph", "Must stop until children are visible"],
        a: 1,
        why: "Texas requires stopping in both directions UNLESS a physical barrier (raised median or barrier) divides the road — paint alone does not exempt oncoming traffic.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Right of Way" },
      { id: "tx-004", cat: "safety", jurisdiction: ["TX"], concept: "following-distance",
        q: "Texas guidance recommends a following distance of at least:",
        choices: ["One second per 20 mph", "Two seconds, extended in rain or at speed", "Half a car length", "Ten feet per 10 mph"],
        a: 1,
        why: "Texas teaches a two-second minimum gap, stretched further at highway speeds or in poor weather — count 'one-thousand-one, one-thousand-two' between the car ahead passing a fixed point and you reaching it.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Defensive Driving" },
      { id: "tx-005", cat: "row", jurisdiction: ["TX"], concept: "right-on-red",
        q: "In Texas, a right turn on red is:",
        choices: ["Always illegal in cities", "Allowed after a complete stop unless a sign prohibits it", "Allowed without stopping", "Only allowed on green arrows"],
        a: 1,
        why: "Texas permits right on red after a complete stop and yielding, unless a posted sign forbids it at that intersection.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Traffic Laws" },
      { id: "tx-006", cat: "laws", jurisdiction: ["TX"], concept: "phone-use",
        q: "Texas statewide law restricts texting while driving by:",
        choices: ["Banning it for all drivers", "Allowing it at red lights", "Banning it only for minors", "Leaving it entirely to cities"],
        a: 0,
        why: "Texas bans reading, writing, or sending electronic messages while driving for ALL drivers statewide — many cities add stricter local ordinances.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Distractions" },
      { id: "tx-007", cat: "speed", form: "recall", jurisdiction: ["TX"], concept: "speed-limits",
        q: "In a Texas urban district with no posted limit, the default maximum is:",
        choices: ["25 mph", "20 mph", "30 mph", "40 mph"],
        a: 2,
        why: "Texas sets 30 mph as the urban-district default where no sign posts otherwise — the 30 mph figure is the baseline; rural numbered highways run higher.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Speed Limits" },
      { id: "tx-008", cat: "speed", form: "scenario", jurisdiction: ["TX"], concept: "speed-limits",
        q: "On a numbered Texas highway outside an urban district (daytime, no special zone posted), the default limit is:",
        choices: ["30 mph", "55 mph", "65 mph", "70 mph"],
        a: 3,
        why: "Outside cities, numbered Texas highways default to 70 mph by day and 65 at night — far above the 30 mph city default — unless signs post a different limit.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Speed Limits" },
      { id: "tx-009", cat: "laws", form: "recall", jurisdiction: ["TX"], concept: "left-on-red",
        q: "In Texas, you may turn left on red:",
        choices: ["After stopping, from a one-way street onto a one-way street", "Never under any circumstance", "After slowing to 10 mph", "Only outside city limits"],
        a: 0,
        why: "Texas permits a left on red only after a complete stop when turning from a one-way street onto another one-way street — the mirror image of right on red, and illegal from or onto two-way roads.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Traffic Laws" },
      { id: "tx-010", cat: "vulnerable", form: "scenario", jurisdiction: ["TX"], concept: "school-zone-speed",
        q: "A Texas school-zone sign flashes 15 mph during drop-off hours. You must:",
        choices: ["Hold your normal speed", "Stop until the lights end", "Slow to 15 mph through the zone", "Pull over and wait"],
        a: 2,
        why: "A flashing school-zone limit is a hard 15 mph cap while children arrive or leave — slow to 15 mph through the zone and watch for crossing guards.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "School Zones" },
      { id: "tx-011", cat: "safety", form: "scenario", jurisdiction: ["TX"], concept: "following-distance",
        q: "Texas teaches a two-second following gap. In rain or at highway speed you should:",
        choices: ["Shorten it to one second", "Keep it exactly the same", "Close up so no one cuts in", "Lengthen it beyond two seconds"],
        a: 3,
        why: "Two seconds is the minimum Texas gap — stretch it further in rain or at speed, because wet pavement lengthens braking distance and spray hides brake lights.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Defensive Driving" },
      { id: "tx-012", cat: "laws", form: "scenario", jurisdiction: ["TX"], concept: "move-over",
        q: "An ambulance with flashing lights is stopped on the shoulder. No lane change is possible. Texas requires you to:",
        choices: ["Maintain speed and position", "Stop dead in your lane", "Move over — not possible here", "Slow to 20 mph below the limit and pass with care"],
        a: 3,
        why: "The Texas move-over law says to vacate the lane beside stopped emergency vehicles — or, when blocked, slow to 20 mph below the posted limit and give the crew room.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Sharing the Road" },
      { id: "tx-013", cat: "laws", form: "recall", jurisdiction: ["TX"], concept: "work-zones",
        q: "Fines for moving violations in a Texas work zone with workers present are:",
        choices: ["Halved for first offenses", "Unchanged from normal roads", "Doubled", "Waived at night"],
        a: 2,
        why: "Texas doubles fines in work zones when workers are present — the doubled fine reflects that crews stand feet from traffic with no protection.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Work Zones" },
      { id: "tx-014", cat: "laws", form: "recall", jurisdiction: ["TX"], concept: "open-container",
        q: "An open container of alcohol in your Texas car is:",
        choices: ["Legal in the passenger area", "Legal for passengers only", "Legal on rural roads", "Prohibited in the passenger area — use the trunk or behind the last seat"],
        a: 3,
        why: "Texas bans open containers in the passenger area — a half-finished bottle belongs in the trunk or behind the last upright seat, never within the driver's reach.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Alcohol and Drug Impact" },
      { id: "tx-015", cat: "alcohol", form: "recall", jurisdiction: ["TX"], concept: "dwi-child-passenger",
        q: "A Texas DWI with a passenger under 15 years old is charged as:",
        choices: ["A parking ticket", "A felony with a fine up to $10,000", "A warning for first offenses", "A civil matter only"],
        a: 1,
        why: "Driving while intoxicated with a child under 15 aboard is a state-jail felony in Texas — up to $10,000 in fines — because the child cannot choose the risk.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Alcohol and Drug Impact" },
      { id: "tx-016", cat: "markings", form: "scenario", jurisdiction: ["TX"], concept: "center-turn-lane",
        q: "A Texas road has a center lane edged with a broken yellow line on each side. You may use it to:",
        choices: ["Pass slower traffic", "Cruise through for a mile", "Turn left from either direction", "Park during rush hour"],
        a: 2,
        why: "A two-way left-turn lane serves left turns from either direction — enter it just before your turn, never to pass, cruise, or park in it.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Signs, Signals and Markings" },
      { id: "tx-017", cat: "signs", form: "recall", jurisdiction: ["TX"], concept: "railroad-stop",
        q: "A Texas school bus approaching a railroad crossing must:",
        choices: ["Cross without stopping", "Speed up to beat the train", "Stop 200 feet back", "Stop within 50 feet but no closer than 15 feet, then cross when safe"],
        a: 3,
        why: "Buses and hazmat carriers stop 15 to 50 feet short of the rails — within 50 feet but no closer than 15 — then cross only when the track is provably clear.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Railroad Crossings" },
      { id: "tx-018", cat: "parking", form: "recall", jurisdiction: ["TX"], concept: "parking-clearances",
        q: "Parking within 30 feet of a Texas stop sign or traffic signal is:",
        choices: ["Prohibited", "Allowed for 5 minutes", "Allowed at night", "Allowed on Sundays"],
        a: 0,
        why: "Parking within 30 feet of a stop sign, yield sign, or signal is prohibited in Texas — the 30-foot rule keeps the sign visible and the intersection clear.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Parking" },
      { id: "tx-019", cat: "safety", form: "recall", jurisdiction: ["TX"], concept: "headlight-use",
        q: "Texas requires headlights from half an hour after sunset to half an hour before sunrise, and whenever:",
        choices: ["You feel tired", "Visibility drops below 1,000 feet", "The radio is on", "Passengers ask"],
        a: 1,
        why: "Lights on whenever you cannot see 1,000 feet ahead — darkness, rain, fog, or smoke all trigger the 1,000-foot rule, so others see you in time.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Safe Driving" },
      { id: "tx-020", cat: "laws", form: "scenario", jurisdiction: ["TX"], concept: "driveway-exit",
        q: "Leaving a Texas driveway or alley across a sidewalk, you must:",
        choices: ["Speed across quickly", "Honk and go", "Stop before the sidewalk and yield to pedestrians", "Block the sidewalk briefly"],
        a: 2,
        why: "Stop before the sidewalk, yield to pedestrians and approaching traffic, then ease out — the sidewalk has the right of way over an exiting car.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Right of Way" },
      { id: "tx-021", cat: "safety", form: "recall", jurisdiction: ["TX"], concept: "hot-car",
        q: "On a 95-degree Texas afternoon, a parked car's interior can top 130 degrees in minutes. Leaving a child or pet inside is:",
        choices: ["Safe with a cracked window", "Safe for 10 minutes", "Safe in the shade", "Never safe — heatstroke can kill in minutes"],
        a: 3,
        why: "Cracked windows barely slow the heat — interior temperatures kill in minutes, so leaving a child or pet in a parked Texas car is never safe.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Heat and Your Vehicle" },
      { id: "tx-022", cat: "alcohol", form: "recall", jurisdiction: ["TX"], concept: "dwi-penalties",
        q: "A first Texas DWI (21+) carries up to a $2,000 fine, 3 to 180 days in jail, and:",
        choices: ["A free driving course", "License suspension plus annual surcharges to keep your license", "A medal", "Nothing further"],
        a: 1,
        why: "A first DWI brings license suspension, thousands in fines and state surcharges, and possible ignition-interlock time — the suspension plus surcharges keep costing long after court.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Alcohol and Drug Impact" },
      { id: "tx-023", cat: "vehicle", form: "recall", jurisdiction: ["TX"], concept: "towing-chains",
        q: "Towing a trailer in Texas, your safety chains must be:",
        choices: ["Crossed under the tongue and strong enough for the load", "Removed for short trips", "Attached to the bumper only", "Long enough to drag the ground"],
        a: 0,
        why: "Cross the safety chains under the trailer tongue so they cradle it if the hitch fails — crossed chains rated for the load keep a loose trailer tracking straight.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Towing" },
      { id: "tx-024", cat: "markings", form: "recall", jurisdiction: ["TX"], concept: "no-passing-zones",
        q: "Texas forbids passing within 100 feet of:",
        choices: ["An open highway", "A straight rural road", "An intersection, railroad crossing, bridge, or tunnel", "A parking lot"],
        a: 2,
        why: "No passing within 100 feet of intersections, railroad crossings, bridges, or tunnels — each hides oncoming traffic or leaves no escape room.",
        sourceId: "tx-dps-driver-handbook", sourceSection: "Passing" },
    ],
  },
  NY: {
    id: "NY",
    name: "New York (DMV)",
    sourceId: "ny-dmv-driver-manual",
    facts: {
      bacAdult: "0.08% (0.18% is aggravated DWI)",
      bacUnder21: "0.02% — zero tolerance",
      followDistance: "4-second rule recommended",
      rightOnRed: "Allowed after stop unless a sign prohibits it; NEVER in New York City, where it is prohibited citywide",
      schoolBus: "Stop in both directions, even on divided highways",
      handheldPhone: "Portable-electronics ban — fines plus points on your license",
    },
    questions: [
      { id: "ny-001", cat: "row", jurisdiction: ["NY"], concept: "right-on-red",
        q: "You stop at a red light in New York City with no signs about turning. You may turn right:",
        choices: ["After a complete stop", "Never — right on red is prohibited citywide in NYC", "Only between 9am and 5pm", "Only onto one-way streets"],
        a: 1,
        why: "New York City prohibits right turn on red EVERYWHERE within city limits unless a sign expressly allows it. In the rest of New York State, right on red follows the usual after-a-complete-stop rule.",
        sourceId: "ny-dmv-driver-manual", sourceSection: "Traffic Control" },
      { id: "ny-002", cat: "alcohol", jurisdiction: ["NY"], concept: "zero-tolerance",
        q: "New York's zero-tolerance law for drivers under 21 starts at a BAC of:",
        choices: ["0.08%", "0.05%", "0.02%", "0.10%"],
        a: 2,
        why: "New York drivers under 21 face license suspension at just 0.02% BAC — well under the 0.08% adult DWI threshold.",
        sourceId: "ny-dmv-driver-manual", sourceSection: "Alcohol and Drugs" },
      { id: "ny-003", cat: "alcohol", jurisdiction: ["NY"], concept: "bac-limits",
        q: "A New York driver arrested at a 0.19% BAC faces:",
        choices: ["Standard DWI charges only", "Aggravated DWI — harsher penalties", "No charge below 0.20%", "Only a warning for a first offense"],
        a: 1,
        why: "New York elevates DWI at or above 0.18% BAC to AGGRAVATED DWI, carrying steeper fines and longer license revocation than a standard 0.08% DWI.",
        sourceId: "ny-dmv-driver-manual", sourceSection: "Alcohol and Drugs" },
      { id: "ny-004", cat: "laws", jurisdiction: ["NY"], concept: "phone-use",
        q: "Using a portable electronic device while driving in New York results in:",
        choices: ["Nothing, if driving carefully", "A fine only", "A fine AND points on your license", "Points only for repeat offenses"],
        a: 2,
        why: "New York's handheld-device ban adds POINTS to your license on top of fines — five points for a first conviction — because distraction crashes are a leading killer.",
        sourceId: "ny-dmv-driver-manual", sourceSection: "Distractions" },
      { id: "ny-005", cat: "vulnerable", jurisdiction: ["NY"], concept: "school-bus",
        q: "New York school bus rules require oncoming traffic on a DIVIDED highway to:",
        choices: ["Continue normally", "Stop along with same-direction traffic", "Slow to 15 mph", "Stop only for flashing red lights on their side"],
        a: 1,
        why: "New York is stricter than most states: even on divided highways, traffic in BOTH directions must stop for a school bus displaying flashing red lights.",
        sourceId: "ny-dmv-driver-manual", sourceSection: "School Buses" },
      { id: "ny-006", cat: "safety", jurisdiction: ["NY"], concept: "following-distance",
        q: "The New York DMV recommends keeping a following distance of:",
        choices: ["One second", "Two seconds", "About four seconds", "Half a block"],
        a: 2,
        why: "New York teaches roughly FOUR seconds of following space — longer than the classic two/three-second rules — to leave room for reaction plus braking in dense traffic.",
        sourceId: "ny-dmv-driver-manual", sourceSection: "Defensive Driving" },
    ],
  },
  FL: {
    id: "FL",
    name: "Florida (FLHSMV)",
    sourceId: "fl-flhsmv-handbook",
    facts: {
      bacAdult: "0.08%",
      bacUnder21: "0.02% or more",
      followDistance: "3-second rule, 4+ in rain",
      rightOnRed: "Allowed after a complete stop unless posted otherwise",
      schoolBus: "Stop in both directions unless a median divides the road",
      moveOver: "Move over one lane (or slow 20 mph below the limit) for stopped emergency/service vehicles",
    },
    questions: [
      { id: "fl-001", cat: "laws", jurisdiction: ["FL"], concept: "move-over",
        q: "Passing a tow truck working beside a Florida interstate lane, you should:",
        choices: ["Maintain speed and position", "Move over a lane, or slow to 20 mph below the limit if you cannot", "Sound your horn to warn the operator", "Stop completely in your lane"],
        a: 1,
        why: "Florida's Move Over Act requires changing lanes away from stopped emergency/service/tow vehicles — or, when you can't change lanes, slowing to 20 mph BELOW the posted limit.",
        sourceId: "fl-flhsmv-handbook", sourceSection: "Sharing the Road" },
      { id: "fl-002", cat: "alcohol", jurisdiction: ["FL"], concept: "zero-tolerance",
        q: "For drivers under 21 in Florida, the administrative penalty begins at a BAC of:",
        choices: ["0.08%", "0.04%", "0.02%", "0.10%"],
        a: 2,
        why: "Florida suspends the license of under-21 drivers measuring 0.02% BAC or more — roughly a single serving of alcohol.",
        sourceId: "fl-flhsmv-handbook", sourceSection: "Driving Under the Influence" },
      { id: "fl-003", cat: "vulnerable", jurisdiction: ["FL"], concept: "school-bus",
        q: "On a Florida road with a painted center turn lane but NO physical median, oncoming traffic meeting a stopped school bus with flashing reds must:",
        choices: ["Continue at reduced speed", "Stop in both directions", "Stop only on the bus's side", "Change lanes and pass"],
        a: 1,
        why: "Florida exempts oncoming traffic ONLY when a PHYSICAL median divides the roadway. Pavement markings like a turn lane do NOT exempt you — both directions stop.",
        sourceId: "fl-flhsmv-handbook", sourceSection: "School Bus Safety" },
      { id: "fl-004", cat: "safety", jurisdiction: ["FL"], concept: "following-distance",
        q: "Driving in heavy Florida rain, your following distance should be:",
        choices: ["One second", "Three seconds or more — extend to four+", "Shorter so drivers can't cut in", "Unchanged from dry conditions"],
        a: 1,
        why: "Florida teaches three seconds dry, extending beyond four in rain — wet pavement can double braking distance, and sudden downpours are routine.",
        sourceId: "fl-flhsmv-handbook", sourceSection: "Defensive Driving" },
      { id: "fl-005", cat: "row", jurisdiction: ["FL"], concept: "right-on-red",
        q: "In Florida, right turn on red is permitted:",
        choices: ["Everywhere, at any speed", "After a complete stop unless posted otherwise", "Only outside cities", "Only when a police officer signals"],
        a: 1,
        why: "Florida allows right on red after a FULL stop and yielding to pedestrians/cross traffic, unless a sign prohibits the turn at that intersection.",
        sourceId: "fl-flhsmv-handbook", sourceSection: "Signals and Signs" },
      { id: "fl-006", cat: "alcohol", jurisdiction: ["FL"], concept: "bac-limits",
        q: "The standard adult DUI limit in Florida is a BAC of:",
        choices: ["0.05%", "0.08%", "0.10%", "0.15%"],
        a: 1,
        why: "Florida presumes impairment at 0.08% BAC for drivers 21 and older, matching the nationwide standard — impairment can begin well below the legal line.",
        sourceId: "fl-flhsmv-handbook", sourceSection: "Driving Under the Influence" },
    ],
  },
  WA: {
    id: "WA",
    name: "Washington (DOL)",
    sourceId: "wa-dol-driver-guide",
    facts: {
      bacAdult: "0.08%",
      bacUnder21: "0.02% or more",
      followDistance: "4-second rule in adverse conditions",
      rightOnRed: "Allowed after a complete stop unless posted otherwise",
      schoolBus: "Stop in both directions unless four or more lanes are divided by a median",
      distractedDriving: "E-DUI law — even holding a phone at a light is an offense",
    },
    questions: [
      { id: "wa-001", cat: "laws", jurisdiction: ["WA"], concept: "distracted-driving",
        q: "Under Washington's E-DUI law, holding your phone at a red light is:",
        choices: ["Legal — you are not moving", "Legal for navigation only", "An offense — the law covers stops at lights too", "Only a secondary violation"],
        a: 2,
        why: "Washington's Driving Under the Influence of Electronics (E-DUI) act applies even when temporarily stopped at a light or sign — hold the phone, commit the offense.",
        sourceId: "wa-dol-driver-guide", sourceSection: "Rules of the Road" },
      { id: "wa-002", cat: "alcohol", jurisdiction: ["WA"], concept: "zero-tolerance",
        q: "A Washington driver under 21 exceeds zero tolerance at a BAC of:",
        choices: ["0.08%", "0.05%", "0.02%", "Any amount whatsoever"],
        a: 2,
        why: "Washington sets its under-21 threshold at 0.02% BAC for the administrative offense, alongside the adult 0.08% DUI limit.",
        sourceId: "wa-dol-driver-guide", sourceSection: "Alcohol and Drugs" },
      { id: "wa-003", cat: "vulnerable", jurisdiction: ["WA"], concept: "school-bus",
        q: "On a Washington road with four lanes divided by a median, oncoming traffic facing a stopped school bus with flashing reds:",
        choices: ["Must stop in all cases", "May proceed with caution — four-lane divided roads are exempt", "Must stop for 30 seconds", "Must honk before proceeding"],
        a: 1,
        why: "Washington exempts oncoming traffic only on roads of FOUR OR MORE lanes separated by a median; on smaller undivided roads, both directions stop.",
        sourceId: "wa-dol-driver-guide", sourceSection: "School Bus Rules" },
      { id: "wa-004", cat: "safety", jurisdiction: ["WA"], concept: "following-distance",
        q: "In Washington's frequent rain, the DOL suggests a following distance of:",
        choices: ["Two seconds flat", "About four seconds", "One car length per 5 mph", "As close as visibility allows"],
        a: 1,
        why: "Washington extends the following interval to around four seconds in adverse weather — wet roads lengthen stopping distance dramatically.",
        sourceId: "wa-dol-driver-guide", sourceSection: "Defensive Driving" },
      { id: "wa-005", cat: "row", jurisdiction: ["WA"], concept: "right-on-red",
        q: "Unless a sign prohibits it, a Washington driver may turn right on red after:",
        choices: ["Yielding once", "A complete stop and yielding to pedestrians and cross traffic", "Signaling for ten seconds", "Coming to a rolling stop"],
        a: 1,
        why: "Washington permits right on red following a full stop and yield — the same baseline rule used across most U.S. jurisdictions.",
        sourceId: "wa-dol-driver-guide", sourceSection: "Intersections" },
      { id: "wa-006", cat: "alcohol", jurisdiction: ["WA"], concept: "bac-limits",
        q: "The per-se DUI blood-alcohol level for adults in Washington is:",
        choices: ["0.08%", "0.10%", "0.05%", "0.02%"],
        a: 0,
        why: "Washington's adult legal limit is 0.08% BAC; at or above that figure you are legally presumed under the influence.",
        sourceId: "wa-dol-driver-guide", sourceSection: "Alcohol and Drugs" },
    ],
  },
  PA: {
    id: "PA",
    name: "Pennsylvania (PennDOT)",
    sourceId: "pa-penndot-driver-manual",
    facts: {
      bacAdult: "0.08% (higher DUI tiers at 0.10% and 0.16%)",
      bacUnder21: "0.02% or more",
      followDistance: "4-second rule in poor conditions",
      rightOnRed: "Allowed after a complete stop unless posted otherwise (Philadelphia restrictions apply)",
      schoolBus: "Stop at least 10 feet away; both directions on non-divided roads",
      workZone: "Work-zone violations carry doubled fines and mandatory penalties",
        bikePassing: "At least 4 feet when overtaking a bicycle",
    },
    questions: [
      { id: "pa-001", cat: "laws", jurisdiction: ["PA"], concept: "work-zones",
        q: "Committing a speeding violation inside an active Pennsylvania work zone brings:",
        choices: ["A written warning", "Doubled fines and mandatory penalties", "Nothing if workers aren't visible", "A small flat fee"],
        a: 1,
        why: "Pennsylvania doubles fines for work-zone violations and attaches mandatory penalties — safety corridors protect workers with little physical shielding.",
        sourceId: "pa-penndot-driver-manual", sourceSection: "Work Zones" },
      { id: "pa-002", cat: "vulnerable", jurisdiction: ["PA"], concept: "school-bus",
        q: "Meeting a Pennsylvania school bus with flashing red lights on a non-divided road, you must stop:",
        choices: ["Within 50 feet", "At least 10 feet away, in both directions", "Only on the bus's side", "Wherever convenient"],
        a: 1,
        why: "Pennsylvania requires stopping AT LEAST 10 FEET from the bus, in both directions on non-divided roads, until the reds stop flashing.",
        sourceId: "pa-penndot-driver-manual", sourceSection: "School Bus Stopping" },
      { id: "pa-003", cat: "alcohol", jurisdiction: ["PA"], concept: "bac-limits",
        q: "Pennsylvania escalates DUI penalties into a 'high-rate' tier beginning at a BAC of:",
        choices: ["0.08%", "0.10%", "0.16%", "0.20%"],
        a: 1,
        why: "Pennsylvania tiers DUI: general impairment at 0.08%, HIGH rate at 0.10%, and HIGHEST rate at 0.16% — penalties grow sharply at each tier.",
        sourceId: "pa-penndot-driver-manual", sourceSection: "Driving Under the Influence" },
      { id: "pa-004", cat: "alcohol", jurisdiction: ["PA"], concept: "zero-tolerance",
        q: "Pennsylvania's zero-tolerance BAC threshold for drivers under 21 is:",
        choices: ["0.02% or more", "0.05% or more", "0.08% or more", "Any trace at all"],
        a: 0,
        why: "Pennsylvania suspends under-21 drivers at 0.02% BAC OR MORE under its zero-tolerance provision — the answer, restated: 0.02% or more.",
        sourceId: "pa-penndot-driver-manual", sourceSection: "Young Drivers" },
      { id: "pa-005", cat: "safety", jurisdiction: ["PA"], concept: "following-distance",
        q: "Pennsylvania recommends increasing your normal following distance to about four seconds when:",
        choices: ["Following motorcycles only", "Roads are wet, icy, or visibility is poor", "Driving in cities", "Towing is illegal"],
        a: 1,
        why: "PennDOT's four-second guideline applies in poor conditions — rain, snow, ice, fog — when braking and reaction both degrade.",
        sourceId: "pa-penndot-driver-manual", sourceSection: "Defensive Driving" },
      { id: "pa-006", cat: "row", jurisdiction: ["PA"], concept: "right-on-red",
        q: "Which Pennsylvania location restricts right turns on red more aggressively than the rest of the state?",
        choices: ["Pittsburgh", "Philadelphia", "Harrisburg", "Scranton"],
        a: 1,
        why: "While Pennsylvania generally allows right on red after a complete stop, Philadelphia applies citywide restrictions where turns on red are barred unless signed otherwise.",
        sourceId: "pa-penndot-driver-manual", sourceSection: "Traffic Signals" },
        { id: "pa-007", cat: "vulnerable", jurisdiction: ["PA"], concept: "bike-passing-distance",
          q: "In Pennsylvania, the minimum distance to allow when overtaking a bicycle is:",
          choices: ["2 feet", "3 feet", "4 feet", "No minimum — just don't hit them"],
          a: 2,
          why: "Pennsylvania requires AT LEAST FOUR FEET of clearance when overtaking a bicycle — one foot more than most states. If you cannot pass with four feet, wait until you can.",
          sourceId: "pa-penndot-driver-manual", sourceSection: "Sharing the Road" },
    ],
  },
  // The Great Britain pack lives in js/packs/uk.js. A ~1500-question bank in
  // its own module keeps state-packs.js readable, and lets any future
  // jurisdiction ship its pack the same way. Loaded on demand (ensureUkPack)
  // so boot never parses it for sessions that never select it.
  UK: null, // replaced by the getter below — placeholder until loaded
};
Object.defineProperty(STATE_PACKS, "UK", {
  configurable: true,
  enumerable: true,
  get() { return ukPack || UK_PLACEHOLDER; },
});

const PACK_IDS = Object.keys(STATE_PACKS);

/** Every jurisdiction-tagged question across all packs, flattened. */
function allPackQuestions() {
  return PACK_IDS.flatMap((id) => STATE_PACKS[id].questions || []);
}

/** Questions tagged with `jurisdiction:["CA",...]` belong to specific packs;
    untagged questions are universal to the US bank. The UK bank is
    country-scoped: only UK-tagged questions apply (US universal rules such as
    right-on-red and US BAC limits must never leak into UK study). */
function filterBankForPack(questions, packId) {
  if (!packId || packId === "generic") return questions.filter((q) => !q.jurisdiction);
  const pack = STATE_PACKS[packId];
  const includeUniversal = !pack || pack.includeUniversal !== false;
  return questions.filter((q) =>
    (includeUniversal && (!Array.isArray(q.jurisdiction) || !q.jurisdiction.length)) ||
    (Array.isArray(q.jurisdiction) && q.jurisdiction.includes(packId))
  );
}

function packFacts(packId) {
  return (STATE_PACKS[packId] || STATE_PACKS.generic).facts;
}

function sourceForQuestion(question) {
  return question && question.sourceId ? SOURCE_REGISTRY[question.sourceId] || null : null;
}

function packSource(packId) {
  const pack = STATE_PACKS[packId] || STATE_PACKS.generic;
  return pack.sourceId ? SOURCE_REGISTRY[pack.sourceId] || null : null;
}

const RoadReadyPacks = {
  SOURCE_REGISTRY, UNIVERSAL_DEFAULTS, CONCEPT_FACT_KEYS, VERIFICATION_MAX_AGE_DAYS,
  STATE_PACKS, PACK_IDS, filterBankForPack, packFacts,
  allPackQuestions, sourceForQuestion, packSource,
  ensureUkPack, ukLoaded,
};
if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyPacks;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyPacks = RoadReadyPacks;
