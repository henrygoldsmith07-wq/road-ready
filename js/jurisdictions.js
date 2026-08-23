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
  // Future modules ship as data + a new entry here:
  // uk: { id:"uk", regions:["ENG","WLS","SCT"], terminology:{ agencyShort:"DVSA",
  //      examName:"theory test", learnerPermit:"provisional licence" },
  //      hazardPerception:{ includedInExam:true, positioning:"core section" } },
};

const ACTIVE_COUNTRY = "us";

function activeJurisdiction() {
  return JURISDICTIONS[ACTIVE_COUNTRY] || null;
}

const RoadReadyJurisdictions = { JURISDICTIONS, ACTIVE_COUNTRY, activeJurisdiction };
if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyJurisdictions;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyJurisdictions = RoadReadyJurisdictions;
