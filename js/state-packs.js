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
  "us-dmv-handbooks-composite": {
    jurisdiction: "*", agency: "Multiple state DMVs (composite)",
    title: "U.S. state driver handbooks — commonly taught rules",
    edition: "2025–2026 editions", verified: "2026-08-23",
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
  "work-zones":         ["workZone"],
};

const STATE_PACKS = {
  generic: {
    id: "generic",
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
      handsFree: "No handheld phone use at all for drivers 18+; under-18 drivers may not use a phone even hands-free",
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
        why: "Pennsylvania suspends under-21 drivers at 0.02% BAC or higher under its zero-tolerance provision.",
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
    ],
  },
};

const PACK_IDS = Object.keys(STATE_PACKS);

/** Every jurisdiction-tagged question across all packs, flattened. */
function allPackQuestions() {
  return PACK_IDS.flatMap((id) => STATE_PACKS[id].questions || []);
}

/** Questions tagged with `jurisdiction:["CA",...]` belong to specific packs;
    untagged questions are universal. */
function filterBankForPack(questions, packId) {
  if (!packId || packId === "generic") return questions.filter((q) => !q.jurisdiction);
  return questions.filter((q) => !q.jurisdiction || q.jurisdiction.includes(packId));
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
};
if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyPacks;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyPacks = RoadReadyPacks;
