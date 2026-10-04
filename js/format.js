/* Road Ready — shared formatting helpers.
   Loaded as a classic script before app.js (and the modules it wires), so
   `escapeHTML` is available to every renderer that builds HTML strings.
   app.js re-exports it for compatibility with the existing call sites. */
"use strict";

(function (root) {
  /**
   * Escape a value for safe interpolation into an HTML string. Accepts
   * anything typeof-string-able: non-strings pass through String() first so
   * numbers and null never throw, and control characters never reach markup.
   * This is the ONLY sanctioned way to interpolate values that may have come
   * from imports, sync, or user typing into innerHTML.
   */
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  const RoadReadyFormat = { escapeHTML };
  if (typeof module !== "undefined" && module.exports) module.exports = RoadReadyFormat;
  else /** @type {any} */ (root).RoadReadyFormat = RoadReadyFormat;
})(typeof globalThis !== "undefined" ? globalThis : this);
