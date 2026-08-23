/* Road Ready — official exam blueprints.
 *
 * One entry per jurisdiction pack: the REAL parameters of that state's
 * knowledge exam, cited against SOURCE_REGISTRY. These power the "Official
 * Simulation" mode, which is deliberately NOT user-configurable.
 *
 *   questionCount  questions on the real exam
 *   minCorrect     absolute pass bar on the real exam
 *   timeLimitMin   official time cap, or null when the state imposes none
 *                  (the app then applies its standard 1 min/question pace)
 *   topicWeights   EDITORIAL emphasis multipliers over CATEGORIES — states do
 *                  not publish numeric mixes; these approximate handbook
 *                  chapter emphasis and are validated (keys + range) but are
 *                  not official figures. null = proportional to pool size.
 *
 * Practice mocks remain fully user-configurable elsewhere.
 */
"use strict";

const EXAM_BLUEPRINTS = {
  CA: {
    label: "California Official Simulation",
    sourceId: "ca-dmv-driver-handbook",
    questionCount: 46,
    minCorrect: 38,
    timeLimitMin: null,
    topicWeights: null,
    notes: "Up to 8 wrong allowed (38/46). Three attempts per application fee; after that the fee renews.",
  },
  TX: {
    label: "Texas Official Simulation",
    sourceId: "tx-dps-driver-handbook",
    questionCount: 30,
    minCorrect: 21,
    timeLimitMin: null,
    topicWeights: null,
    notes: "21 of 30 (70%) to pass. Road signs are tested within the same exam.",
  },
  NY: {
    label: "New York Official Simulation",
    sourceId: "ny-dmv-driver-manual",
    questionCount: 20,
    minCorrect: 14,
    timeLimitMin: null,
    topicWeights: null,
    notes: "14 of 20 (70%) to pass.",
  },
  FL: {
    label: "Florida Official Simulation",
    sourceId: "fl-flhsmv-handbook",
    questionCount: 50,
    minCorrect: 40,
    timeLimitMin: 60,
    topicWeights: null,
    notes: "40 of 50 (80%) within 60 minutes. Taken online or at the service center.",
  },
  WA: {
    label: "Washington Official Simulation",
    sourceId: "wa-dol-driver-guide",
    questionCount: 40,
    minCorrect: 32,
    timeLimitMin: null,
    topicWeights: null,
    notes: "32 of 40 (80%) to pass.",
  },
  PA: {
    label: "Pennsylvania Official Simulation",
    sourceId: "pa-penndot-driver-manual",
    questionCount: 18,
    minCorrect: 15,
    timeLimitMin: null,
    topicWeights: null,
    notes: "15 of 18 (83%) to pass.",
  },
};

const RoadReadyBlueprints = { EXAM_BLUEPRINTS };
if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyBlueprints;
else if (typeof globalThis !== "undefined") globalThis.RoadReadyBlueprints = RoadReadyBlueprints;
