/* Captures the first uncaught error for the E2E "no console errors" check.
 * Kept as its own tiny file so index.html can ship a strict CSP that forbids
 * inline scripts instead of weakening the policy with 'unsafe-inline'.
 */
"use strict";
window.addEventListener("error", function (e) {
  window.__lastError = (e.message || "error") + " @ " + (e.filename || "") + ":" + (e.lineno || 0);
});
