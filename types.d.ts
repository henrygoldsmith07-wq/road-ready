/** Global lexical binding created by js/packs/uk.js when it is loaded as a
 *  classic <script> before js/state-packs.js. Declared for the type checker;
 *  under Node the require() fallback in state-packs.js resolves it instead. */
declare const ROADREADY_UK_PACK: any;

/** Classic-script globals from js/state-packs.js, which loads AFTER
 *  js/concepts.js. Every use in concepts.js is guarded by
 *  `typeof X !== "undefined"` and resolves at call time, so these
 *  declarations are type-checker visibility only — no runtime change. */
declare const STATE_PACKS: any;
declare const SOURCE_REGISTRY: any;

interface Window {
  /** Set by js/boot-error.js for the E2E console-error check. */
  __lastError?: string;
  RoadReadyCore: any;
  /** Present only when js/coach.js has loaded before app.js. */
  RoadReadyCoach: any;
  /** Present only when js/mastery.js has loaded before app.js. */
  RoadReadyMastery: any;
  /** Present only when js/explain.js has loaded before app.js. */
  RoadReadyExplain: any;
  /** Present only when js/evidence.js has loaded before app.js. */
  RoadReadyEvidence: any;
  /** Present only when js/concept-map-ui.js has loaded before app.js. */
  RoadReadyConceptMapUI: any;
  /** Present only when js/stats-ui.js has loaded before app.js. */
  RoadReadyStatsUI: any;
  /** Present only when js/format.js has loaded before app.js. */
  RoadReadyFormat: any;
  RoadReadyPacks: any;
  RoadReadyBlueprints: any;
  RoadReadyJurisdictions: any;
  /** Present only when js/account.js has loaded; absent is a valid state. */
  RoadReadyAccount: any;
  RoadReadyAccountUI: any;
  RoadReadyGuide: any;
  /** Present only when js/practical-ui.js has loaded before app.js. */
  RoadReadyPracticalUI: any;
  /** Present only when js/study-ui.js has loaded before app.js. */
  RoadReadyStudyUI: any;
  /** Present only when js/home-ui.js has loaded before app.js. */
  RoadReadyHomeUI: any;
  /** Present only when js/quiz-ui.js has loaded before app.js. */
  RoadReadyQuizUI: any;
  /** Present only when js/flashcards-ui.js has loaded before app.js. */
  RoadReadyFlashcardsUI: any;
  /** Present only when js/review-ui.js has loaded before app.js. */
  RoadReadyReviewUI: any;
  /** Present only when js/results-ui.js has loaded before app.js. */
  RoadReadyResultsUI: any;
  /** Present only when js/hazard-ui.js has loaded before app.js. */
  RoadReadyHazardUI: any;
  /** Present only when js/hazard-scenarios.js has loaded before app.js. */
  RoadReadyHazardScenarios: any;
}
