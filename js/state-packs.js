/* Road Ready — state-specific content packs.
   Generic bank covers rules common across U.S. states; a pack overrides the
   numbers that vary by state and can tag questions as state-specific.
   Selected pack is stored in settings.statePack ("generic" = no override). */
"use strict";

(function (root) {
  "use strict";

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
    },
    CA: {
      id: "CA",
      name: "California (DMV)",
      facts: {
        bacAdult: "0.08% (0.04% for commercial drivers)",
        bacUnder21: "0.01% or more — zero tolerance",
        followDistance: "3-second rule",
        rightOnRed: "Allowed after a complete stop unless a sign prohibits it",
        schoolBus: "Stop in both directions on undivided roads when red lights flash",
        speedResidential: "25 mph",
        handsFree: "No handheld phone use at all for drivers 18+; under-18 drivers may not use a phone even hands-free",
      },
    },
    TX: {
      id: "TX",
      name: "Texas (DPS)",
      facts: {
        bacAdult: "0.08%",
        bacUnder21: "any detectable amount",
        followDistance: "2-second minimum, more at speed or in rain",
        rightOnRed: "Allowed after a complete stop unless posted otherwise",
        schoolBus: "Stop in both directions on any road unless a physical barrier divides them",
        speedUrban: "30 mph default in cities unless posted",
      },
    },
    NY: {
      id: "NY",
      name: "New York (DMV)",
      facts: {
        bacAdult: "0.08% (0.18% is aggravated DWI)",
        bacUnder21: "0.02% — zero tolerance",
        followDistance: "4-second rule recommended",
        rightOnRed: "Allowed after stop unless a sign prohibits it; NEVER in New York City, where it is prohibited citywide",
        schoolBus: "Stop in both directions, even on divided highways",
        handheldPhone: "Portable-electronics ban — fines plus points on your license",
      },
    },
    FL: {
      id: "FL",
      name: "Florida (FLHSMV)",
      facts: {
        bacAdult: "0.08%",
        bacUnder21: "0.02% or more",
        followDistance: "3-second rule, 4+ in rain",
        rightOnRed: "Allowed after a complete stop unless posted otherwise",
        schoolBus: "Stop in both directions unless a median divides the road",
        moveOver: "Move over one lane (or slow 20 mph below the limit) for stopped emergency/service vehicles",
      },
    },
    WA: {
      id: "WA",
      name: "Washington (DOL)",
      facts: {
        bacAdult: "0.08%",
        bacUnder21: "0.02% or more",
        followDistance: "4-second rule in adverse conditions",
        rightOnRed: "Allowed after a complete stop unless posted otherwise",
        schoolBus: "Stop in both directions unless four or more lanes are divided by a median",
        distractedDriving: "E-DUI law — even holding a phone at a light is an offense",
      },
    },
    PA: {
      id: "PA",
      name: "Pennsylvania (PennDOT)",
      facts: {
        bacAdult: "0.08% (higher DUI tiers at 0.10% and 0.16%)",
        bacUnder21: "0.02% or more",
        followDistance: "4-second rule in poor conditions",
        rightOnRed: "Allowed after a complete stop unless posted otherwise (Philadelphia restrictions apply)",
        schoolBus: "Stop at least 10 feet away; both directions on non-divided roads",
        workZone: "Work-zone violations carry doubled fines and mandatory penalties",
      },
    },
  };

  const PACK_IDS = Object.keys(STATE_PACKS);

  /** Questions tagged with `states:["CA",...]` belong to specific packs;
      untagged questions are universal. */
  function filterBankForPack(questions, packId) {
    if (!packId || packId === "generic") return questions.filter((q) => !q.states);
    return questions.filter((q) => !q.states || q.states.includes(packId));
  }

  function packFacts(packId) {
    return (STATE_PACKS[packId] || STATE_PACKS.generic).facts;
  }

  const RoadReadyPacks = { STATE_PACKS, PACK_IDS, filterBankForPack, packFacts };
  if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyPacks;
  else root.RoadReadyPacks = RoadReadyPacks;
})(typeof globalThis !== "undefined" ? globalThis : this);
