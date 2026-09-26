interface Window {
  /** Set by js/boot-error.js for the E2E console-error check. */
  __lastError?: string;
  RoadReadyCore: any;
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
