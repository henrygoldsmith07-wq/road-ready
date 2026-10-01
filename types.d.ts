/** Global lexical binding created by js/packs/uk.js when it is loaded as a
 *  classic <script> before js/state-packs.js. Declared for the type checker;
 *  under Node the require() fallback in state-packs.js resolves it instead. */
declare const ROADREADY_UK_PACK: any;

interface Window {
  /** Set by js/boot-error.js for the E2E console-error check. */
  __lastError?: string;
  RoadReadyCore: any;
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
}
