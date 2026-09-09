/* Road Ready — jurisdiction registry (pluggable product architecture).
 *
 * PRODUCT DECISION (2026-08-23): Road Ready is a jurisdiction-pluggable
 * driving-theory trainer. It launches with ONE jurisdiction done extremely
 * well — the United States — and grows by adding jurisdiction modules, not by
 * special-casing content.
 *
 * A jurisdiction module ships, per country:
 *   - regions:        its sub-jurisdictions (state packs, each with questions,
 *                     facts and a SOURCE_REGISTRY citation)
 *   - examBlueprints: official exam simulations keyed by region id
 *   - terminology:    local vocabulary (agency name, exam name, permit term)
 *   - scoring/signs/  shared engines stay generic; anything jurisdiction-
 *   test formats     specific lives in the module's data files
 *
 * Cross-module contract enforced by the content QA system:
 *   every non-generic region pack MUST be listed in its country's regions,
 *   and every exam blueprint key MUST match a region.
 */
"use strict";

const JURISDICTIONS = {
  us: {
    id: "us",
    name: "United States",
    active: true, // launch jurisdiction
    regions: ["CA", "TX", "NY", "FL", "WA", "PA"],
    defaultRegion: null, // users pick a state; "generic" = universal bank only
    terminology: {
      agencyShort: "DMV",          // generic US shorthand (states vary — see SOURCE_REGISTRY agencies)
      examName: "knowledge test",
      examShort: "written test",
      learnerPermit: "learner's permit",
    },
    hazardPerception: {
      // honesty note: most US states do NOT run a hazard-perception test
      includedInExam: false,
      positioning: "bonus training",
    },
  },
  // Second shipped module: United Kingdom (car theory test). Added only
  // because a learner here will sit that test — never as a tease.
  uk: {
    id: "uk",
    name: "United Kingdom",
    active: true,
    regions: ["UK"],
    defaultRegion: null, // users pick the UK car pack; universal US bank never mixes in
    terminology: {
      agencyShort: "DVSA",          // Driver and Vehicle Standards Agency (GB car theory)
      examName: "theory test",
      examShort: "theory test",
      learnerPermit: "provisional licence",
    },
    hazardPerception: {
      includedInExam: true,
      positioning: "core section",
      trainingLabel: "Hazard identification training",
      officialLabel: "Official-test simulation unavailable",
      officialNote: "Road Ready uses original scenarios, not DVSA clips; this is training, not an official simulation.",
    },
  },
};

const ACTIVE_COUNTRY = "us";

function activeJurisdiction() {
  return JURISDICTIONS[ACTIVE_COUNTRY] || null;
}

/**
 * The runtime jurisdiction TREE (the product map):
 *   Road Ready
 *   ├─ United States
 *   │   ├─ California …
 * Built by joining the registry with the loaded region packs, blueprints and
 * source agencies, so a new country module appears here automatically once its
 * data files + registry entry exist. Only `active: true` countries are listed.
 */
function jurisdictionTree(registries) {
  const { STATE_PACKS = {}, EXAM_BLUEPRINTS = {}, SOURCE_REGISTRY = {} } = registries || {};
  return Object.values(JURISDICTIONS)
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id,
      name: c.name,
      terminology: c.terminology,
      hazardPerception: c.hazardPerception,
      regions: (c.regions || []).map((rid) => {
        const pack = STATE_PACKS[rid];
        const bp = EXAM_BLUEPRINTS[rid];
        const src = bp && SOURCE_REGISTRY[bp.sourceId];
        return {
          id: rid,
          name: pack ? pack.name : rid,
          questionCount: pack ? (pack.questions || []).length : 0,
          exam: bp ? {
            label: bp.label,
            questionCount: bp.questionCount,
            minCorrect: bp.minCorrect,
            timeLimitMin: bp.timeLimitMin ?? null,
            authority: src ? src.agency : null,
          } : null,
        };
      }),
    }));
}

const RoadReadyJurisdictions = { JURISDICTIONS, ACTIVE_COUNTRY, activeJurisdiction, jurisdictionTree };
if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyJurisdictions;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyJurisdictions = RoadReadyJurisdictions;
